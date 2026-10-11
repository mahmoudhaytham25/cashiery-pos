# Infrastructure — Cashiery POS on AWS

Terraform/Terragrunt setup for a **two-environment promotion pipeline**: a
dev EC2 box and a prod EC2 box, each pulling pre-built images from a shared
**ECR** pair and running `docker compose`. Pushes to `develop` build+deploy
to dev; merging to `main` **promotes the exact dev-verified images** to prod
via ECR manifest retagging — the image that was tested is the image that
ships, byte for byte. No AWS keys are stored anywhere (GitHub OIDC). The
nginx frontend is the only public surface (`:3000`); it proxies `/api` to the
backend, which talks to Postgres inside the compose network.

```
push → develop ──► tests ──► CodeBuild(dev):  build changed services → dev-<sha>
                             (+ move dev-latest) ──► SSM redeploy DEV box
merge → main   ──► tests ──► CodeBuild(prod): retag dev-latest → prod-<sha>
                             (+ prod-latest) — manifest copy, no rebuild
                             ──► SSM redeploy PROD box
```

Tag namespaces in the shared repos tell the story: `dev-<sha>` / `prod-<sha>`
are per-release stack tags (both services, always complete — unchanged
services get their `dev-latest` manifest copied forward rather than
rebuilt), and `dev-latest` / `prod-latest` are the mutable "what each env is
running" pointers.

```
infrastructure/
├── root.hcl                      # region + aws_profile + shared inputs + provider gen
├── live/
│   ├── shared/
│   │   ├── ecr/terragrunt.hcl        # one repo pair — envs are tag namespaces
│   │   └── ci/terragrunt.hcl         # one OIDC role; deps: dev + prod codebuild
│   ├── dev/
│   │   ├── compute/terragrunt.hcl    # dev box: tracks develop, boots dev-latest
│   │   └── codebuild/terragrunt.hcl  # deps: shared/ecr + dev/compute
│   └── prod/
│       ├── compute/terragrunt.hcl    # prod box: tracks main, no demo seed
│       └── codebuild/terragrunt.hcl  # deps: shared/ecr + prod/compute; retag-only
└── modules/
    ├── ecr/        # backend/frontend image repos + lifecycle
    ├── codebuild/  # build project — buildspec.deploy.yml (build) or
    │               #   buildspec.promote.yml (retag); shared SSM block in
    │               #   assets/ssm-redeploy.sh is injected via templatefile
    ├── compute/    # SG, instance IAM role, EC2, EIP, secrets, user_data
    └── ci/         # GitHub OIDC provider + deploy trigger role
```

`terragrunt run --all` resolves the dependency graph — `apply`/`destroy` run
in the right order. `plan`/`validate` work before the first real apply
thanks to `mock_outputs` on each dependency.

## One-time setup

1. Set `region` and `aws_profile` in `infrastructure/root.hcl`.
2. ```bash
   cd infrastructure/live
   terragrunt run --all init
   terragrunt run --all apply
   ```
   (or apply unit by unit in order: shared/ecr → dev+prod compute →
   dev+prod codebuild → shared/ci)
3. Wire the outputs into GitHub (**Settings → Secrets and variables → Actions**):

   | Terraform output (unit)             | GitHub entry             | Kind     |
   |-------------------------------------|--------------------------|----------|
   | `github_deploy_role_arn` (shared/ci) | `AWS_DEPLOY_ROLE_ARN`    | secret   |
   | `project_name` (dev/codebuild)      | `DEV_CODEBUILD_PROJECT`  | variable |
   | `project_name` (prod/codebuild)     | `PROD_CODEBUILD_PROJECT` | variable |
   | *(your region)*                     | `AWS_REGION`             | variable |

4. Push to `develop` → the `deploy-dev` CI job diffs the push and calls
   `codebuild start-build` with `GIT_REF` + `CHANGED_SERVICES` +
   `IMAGE_TAG=dev-<sha>` + `LATEST_TAG=dev-latest`. Merge to `main` →
   `deploy-prod` starts the promote project with `PROMOTE_FROM_TAG=dev-latest`
   — images are retagged, never rebuilt.
   `deploy-prod` declares `environment: production`, so adding required
   reviewers under **Settings → Environments** turns prod promotion into a
   manual-approval gate (the OIDC role already trusts the `environment:`
   subject claim).

First boot: `terragrunt output app_url` in `live/{dev,prod}/compute`, wait
~3 min, check `/var/log/cashiery-bootstrap.log` via `aws ssm start-session
--target <id>` (no SSH key needed; or set `ssh_cidr` + `key_name` in the
compute unit for port 22). The prod box boots onto `dev-latest` — the last
dev-verified image — and switches to `prod-<sha>` on the first promote. To
restrict the dev box to your IP, set
`allowed_app_cidrs = ["<ip>/32"]` in `live/dev/compute/terragrunt.hcl`.

Edge case worth knowing: a promote with no prior dev deploy finds no
`dev-latest` tag and exits successfully with "nothing promoted yet" — push
to `develop` first.

## Secrets

`JWT_SECRET` and `POSTGRES_PASSWORD` are generated per environment by
Terraform (`random_password`), written to `/opt/cashiery-pos/.env` (chmod
600), and exposed as sensitive outputs (`terragrunt output jwt_secret`).
They live in state — move to the encrypted S3 backend (commented block in
`root.hcl`) before sharing.

## Deploying a new release

Work on `develop` — every push redeploys the dev box. Merge to `main` to
ship to prod. To pin a specific commit on first boot, set `image_tag` in the
compute unit — changing user_data replaces the instance (fresh box, empty
DB volume).

## Cost note

2× t3.micro + 20 GB gp3 each + 2 EIP + ECR ≈ ~$20/mo (t3.micro is free-tier
eligible year one). EIPs are free while attached to running instances —
**`terragrunt run --all destroy` when done**; an unattached EIP bills hourly.
