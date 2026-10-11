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

variable "repo_url" {
  description = "Repo the buildspec clones at the pushed SHA (public HTTPS — no credentials needed)."
  type        = string
  default     = "https://github.com/mahmoudhaytham25/cashiery-pos.git"
}

variable "ecr_registry" {
  description = "ECR registry the builds push to (dependency: ecr module output)."
  type        = string
}

variable "backend_repository_arn" {
  description = "Backend ECR repo ARN — scopes the service role's push permissions."
  type        = string
}

variable "frontend_repository_arn" {
  description = "Frontend ECR repo ARN — scopes the service role's push permissions."
  type        = string
}

variable "ecr_backend_repo" {
  description = "Backend repo name — project env var consumed by the buildspec."
  type        = string
}

variable "ecr_frontend_repo" {
  description = "Frontend repo name — project env var consumed by the buildspec."
  type        = string
}

variable "instance_id" {
  description = "EC2 instance the buildspec redeploys via SSM (dependency: compute module output)."
  type        = string
}

variable "buildspec_file" {
  description = "Buildspec filename in this module — 'buildspec.deploy.yml' (dev: clone, build, push, redeploy) or 'buildspec.promote.yml' (prod: ECR retag + redeploy)."
  type        = string
  default     = "buildspec.deploy.yml"
}

variable "privileged" {
  description = "CodeBuild privileged mode — required for docker builds. The promote project only copies ECR manifests, so it stays false."
  type        = bool
  default     = true
}
