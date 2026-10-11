include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${get_repo_root()}/infrastructure//modules/ci"
}

dependency "dev_codebuild" {
  config_path = "../../dev/codebuild"

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    project_arn = "arn:aws:codebuild:us-east-1:000000000000:project/mock-dev"
  }
}

dependency "prod_codebuild" {
  config_path = "../../prod/codebuild"

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    project_arn = "arn:aws:codebuild:us-east-1:000000000000:project/mock-prod"
  }
}

# One OIDC role for the whole pipeline — assumable from main and develop,
# permitted to start either the dev (build) or prod (promote) project.
inputs = {
  environment = "shared"

  codebuild_project_arns = [
    dependency.dev_codebuild.outputs.project_arn,
    dependency.prod_codebuild.outputs.project_arn,
  ]

  # github_repo = "mahmoudhaytham25/cashiery-pos"  # default already correct
}
