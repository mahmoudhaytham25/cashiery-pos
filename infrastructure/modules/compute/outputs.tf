output "public_ip" {
  description = "Public address of the instance (EIP if allocated)."
  value       = var.allocate_eip ? aws_eip.app[0].public_ip : aws_instance.app.public_ip
}

output "app_url" {
  description = "URL of the Cashiery frontend."
  value       = "http://${var.allocate_eip ? aws_eip.app[0].public_ip : aws_instance.app.public_ip}:${var.app_port}"
}

output "instance_id" {
  description = "Instance ID — set as the INSTANCE_ID GitHub Actions variable."
  value       = aws_instance.app.id
}

output "ssm_connect_command" {
  description = "Shell into the box without SSH (needs Session Manager plugin)."
  value       = "aws ssm start-session --target ${aws_instance.app.id}"
}

output "jwt_secret" {
  description = "Generated JWT signing secret (also written to /opt/cashiery-pos/.env on the instance)."
  value       = random_password.jwt.result
  sensitive   = true
}

output "db_password" {
  description = "Generated Postgres password."
  value       = random_password.db.result
  sensitive   = true
}
