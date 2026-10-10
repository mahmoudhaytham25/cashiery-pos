locals {
  name = "${var.project}-${var.environment}"
}

data "aws_region" "current" {}

resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "random_password" "db" {
  length  = 32
  special = false
}

# --------------------------------------------------------------------------
# Networking — default VPC keeps this a one-file deployment. Swap for a
# dedicated VPC module if this ever graduates past "demo on a box".
# --------------------------------------------------------------------------

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "app" {
  name        = local.name
  description = "Cashiery POS — public app port, optional SSH"
  vpc_id      = data.aws_vpc.default.id

  tags = { Name = local.name }
}

resource "aws_vpc_security_group_ingress_rule" "app" {
  for_each          = toset(var.allowed_app_cidrs)
  security_group_id = aws_security_group.app.id
  description       = "Frontend (nginx) + proxied API"
  cidr_ipv4         = each.value
  from_port         = var.app_port
  to_port           = var.app_port
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  count             = var.ssh_cidr != null ? 1 : 0
  security_group_id = aws_security_group.app.id
  description       = "SSH"
  cidr_ipv4         = var.ssh_cidr
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.app.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# --------------------------------------------------------------------------
# IAM — SSM for shell access without port 22, ECR read for image pulls.
# --------------------------------------------------------------------------

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = local.name
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Pulls the app images — no AWS credentials needed on the box beyond its role.
resource "aws_iam_role_policy_attachment" "ecr_read" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_instance_profile" "app" {
  name = local.name
  role = aws_iam_role.app.name
}

# --------------------------------------------------------------------------
# Instance
# --------------------------------------------------------------------------

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name
  key_name               = var.key_name

  metadata_options {
    http_tokens                 = "required" # IMDSv2 only
    http_put_response_hop_limit = 2          # docker bridge adds a hop
  }

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    repo_url      = var.repo_url
    repo_ref      = var.repo_ref
    app_port      = var.app_port
    aws_region    = data.aws_region.current.name
    ecr_registry  = var.ecr_registry
    backend_repo  = var.ecr_backend_repo
    frontend_repo = var.ecr_frontend_repo
    image_tag     = var.image_tag
    jwt_secret    = random_password.jwt.result
    db_password   = random_password.db.result
    seed_products = var.seed_products
  })

  # Re-run bootstrap when the compose/env inputs change.
  user_data_replace_on_change = true

  tags = { Name = local.name }
}

resource "aws_eip" "app" {
  count    = var.allocate_eip ? 1 : 0
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = { Name = local.name }
}
