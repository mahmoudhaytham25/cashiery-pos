include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${get_repo_root()}/infrastructure//modules/codebuild"
}

dependency "ecr" {
  config_path = "../../shared/ecr"

  # Lets validate/plan run before the first real apply.
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    ecr_registry             = "000000000000.dkr.ecr.us-east-1.amazonaws.com"
    backend_repository_arn   = "arn:aws:ecr:us-east-1:000000000000:repository/mock-backend"
    frontend_repository_arn  = "arn:aws:ecr:us-east-1:000000000000:repository/mock-frontend"
    backend_repository_name  = "mock-backend"
    frontend_repository_name = "mock-frontend"
  }
}

dependency "compute" {
  config_path = "../compute"

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    instance_id = "i-00000000000000000"
  }
}

inputs = {
  environment = "prod"

  # Prod never builds — it copies the dev-verified image manifest to a prod
  # tag (batch-get-image + put-image) and redeploys. No docker daemon needed,
  # so privileged mode stays off.
  buildspec_file = "buildspec.promote.yml"
  privileged     = false

  ecr_registry            = dependency.ecr.outputs.ecr_registry
  backend_repository_arn  = dependency.ecr.outputs.backend_repository_arn
  frontend_repository_arn = dependency.ecr.outputs.frontend_repository_arn
  ecr_backend_repo        = dependency.ecr.outputs.backend_repository_name
  ecr_frontend_repo       = dependency.ecr.outputs.frontend_repository_name
  instance_id             = dependency.compute.outputs.instance_id
}
