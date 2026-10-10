include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${get_repo_root()}/infrastructure//modules/ci"
}

dependency "codebuild" {
  config_path = "../codebuild"

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    project_arn = "arn:aws:codebuild:us-east-1:000000000000:project/mock"
  }
}

inputs = {
  environment           = "dev"
  codebuild_project_arn = dependency.codebuild.outputs.project_arn

  # github_repo = "mahmoudhaytham25/cashiery-pos"  # default already correct
}
