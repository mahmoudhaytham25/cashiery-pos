variable "aws_profile" {
  description = "AWS CLI profile used by the provider. Passed through solely so an empty value fails loudly at plan time instead of silently falling back to ambient credentials."

  type = string

  validation {
    condition     = var.aws_profile != ""
    error_message = "aws_profile is empty — set it in infrastructure/terragrunt.hcl (top locals block). Ambient credentials are deliberately not used."
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

variable "instance_type" {
  description = "EC2 instance type. t3.micro suffices — the instance pulls images rather than building, so the only real consumers are Postgres (~150 MB) and Node (~150 MB)."
  type        = string
  default     = "t3.micro"
}

variable "repo_url" {
  description = "Git URL cloned onto the instance at boot."
  type        = string
  default     = "https://github.com/mahmoudhaytham25/cashiery-pos.git"
}

variable "repo_ref" {
  description = "Branch, tag or commit checked out on the instance (for the compose file)."
  type        = string
  default     = "main"
}

variable "app_port" {
  description = "Host port the nginx frontend container is published on (compose maps 3000:80)."
  type        = number
  default     = 3000
}

variable "allowed_app_cidrs" {
  description = "CIDRs allowed to reach the app port."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_cidr" {
  description = "CIDR allowed to SSH (port 22). Null/empty disables the SSH rule — prefer SSM Session Manager."
  type        = string
  default     = null
}

variable "key_name" {
  description = "EC2 key pair name for SSH access. Optional if using SSM."
  type        = string
  default     = null
}

variable "image_tag" {
  description = "ECR image tag deployed on first boot. After that the CI deploy job owns the tag via the .env rewrite."
  type        = string
  default     = "latest"
}

variable "seed_products" {
  description = "Seed the demo product catalog on first run (SEED_PRODUCTS env in compose)."
  type        = bool
  default     = true
}

variable "allocate_eip" {
  description = "Attach an Elastic IP so the public address survives stop/start."
  type        = bool
  default     = true
}

variable "root_volume_size" {
  description = "Root EBS volume size in GB (images + postgres data live here)."
  type        = number
  default     = 20
}

variable "ecr_registry" {
  description = "ECR registry — written into the box's .env (dependency: ecr module output)."
  type        = string
}

variable "ecr_backend_repo" {
  description = "Backend ECR repo name — written into the box's .env."
  type        = string
}

variable "ecr_frontend_repo" {
  description = "Frontend ECR repo name — written into the box's .env."
  type        = string
}
