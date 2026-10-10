variable "aws_profile" {
  description = "AWS CLI profile used by the provider. Passed through solely so an empty value fails loudly at plan time instead of silently falling back to ambient credentials."

  type = string

  validation {
    condition     = var.aws_profile != ""
    error_message = "aws_profile is empty — set it in infrastructure/root.hcl (top locals block). Ambient credentials are deliberately not used."
  }
}

variable "project" {
  description = "Name prefix for all resources."
  type        = string
  default     = "cashiery-pos"
}

variable "environment" {
  description = "Deployment environment (dev, prod, ...)."
  type        = string
}

variable "github_repo" {
  description = "GitHub org/repo whose Actions may assume the deploy role (used in the OIDC trust policy)."
  type        = string
  default     = "mahmoudhaytham25/cashiery-pos"
}

variable "codebuild_project_arn" {
  description = "CodeBuild project the deploy job starts and polls (dependency: codebuild module output)."
  type        = string
}
