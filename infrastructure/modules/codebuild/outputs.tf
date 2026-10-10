output "project_name" {
  description = "Build project name — set as the CODEBUILD_PROJECT GitHub Actions variable."
  value       = aws_codebuild_project.app.name
}

output "project_arn" {
  value = aws_codebuild_project.app.arn
}
