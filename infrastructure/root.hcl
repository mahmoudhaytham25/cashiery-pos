# Root Terragrunt config — shared by every environment under live/.

# --------------------------------------------------------------------------
# Your settings — edit these two:
# --------------------------------------------------------------------------
locals {
  project = "cashiery-pos"
  region  = "us-east-1" # AWS region to deploy into

  # AWS CLI profile to deploy with (a [profile X] from ~/.aws/config or a
  # default-profile name from ~/.aws/credentials). REQUIRED — plan fails if
  # empty; ambient credentials are never used on purpose.
  aws_profile = ""
}
# --------------------------------------------------------------------------

# Shared inputs inherited by every unit under live/. The aws_profile module
# variable carries a validation that fails the plan when it's empty.
inputs = {
  aws_profile = local.aws_profile
  project     = local.project
}

# Generate the provider + default tags in each child so they stay DRY.
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-EOF
    provider "aws" {
      region  = "${local.region}"
      profile = "${local.aws_profile}"

      default_tags {
        tags = {
          Project     = var.project     # declared by every module
          Environment = var.environment # set in live/<env>/<unit>/terragrunt.hcl
          ManagedBy   = "terragrunt"
        }
      }
    }
  EOF
}

# Remote state — uncomment once you've created the bucket + lock table:
#
# remote_state {
#   backend = "s3"
#   config = {
#     bucket         = "your-tfstate-bucket"
#     key            = "${local.project}/${path_relative_to_include()}/terraform.tfstate"
#     region         = local.region
#     dynamodb_table = "terraform-locks"
#     encrypt        = true
#   }
#   generate = {
#     path      = "backend.tf"
#     if_exists = "overwrite_terragrunt"
#   }
# }
#
# Until then state stays local (terraform.tfstate next to the module —
# gitignored, fine for a single-operator demo).
