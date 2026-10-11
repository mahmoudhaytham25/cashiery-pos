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

variable "codebuild_project_arns" {
  description = "CodeBuild projects the deploy jobs may start (dev build + prod promote — dependencies: codebuild module outputs)."
  type        = list(string)
}

variable "deploy_branches" {
  description = "GitHub branches whose Actions runs may assume the deploy role (used in the OIDC trust policy)."
  type        = list(string)
  default     = ["main", "develop"]
}

variable "deploy_environments" {
  description = "GitHub Actions environments whose runs may assume the deploy role — jobs that set `environment:` claim an `environment:<name>` sub instead of a ref."
  type        = list(string)
  default     = ["production"]
}
