output "ecr_registry" {
  description = "ECR registry — set as the ECR_REGISTRY GitHub Actions variable."
  value       = local.ecr_registry
}

output "backend_repository_name" {
  description = "Backend repo name — set as the ECR_BACKEND_REPO GitHub Actions variable."
  value       = aws_ecr_repository.backend.name
}

output "backend_repository_arn" {
  value = aws_ecr_repository.backend.arn
}

output "frontend_repository_name" {
  description = "Frontend repo name — set as the ECR_FRONTEND_REPO GitHub Actions variable."
  value       = aws_ecr_repository.frontend.name
}

output "frontend_repository_arn" {
  value = aws_ecr_repository.frontend.arn
}
