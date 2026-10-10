output "github_deploy_role_arn" {
  description = "Role CI assumes via OIDC — set as the AWS_DEPLOY_ROLE_ARN GitHub Actions secret."
  value       = aws_iam_role.github_deploy.arn
}
