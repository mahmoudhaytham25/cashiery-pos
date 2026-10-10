# One parameterized build project. The GitHub Actions deploy job detects
# which service directories changed in a push and starts this build with
# CHANGED_SERVICES + IMAGE_TAG env overrides. The buildspec (inlined below)
# clones the repo, builds+pushes each changed image to ECR, then redeploys
# the EC2 box over SSM.

locals {
  name = "${var.project}-${var.environment}"
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# --- service role ---------------------------------------------------------

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild" {
  name               = "${local.name}-codebuild"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

data "aws_iam_policy_document" "codebuild" {
  statement {
    sid = "Logs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/codebuild/${local.name}-build*"]
  }

  statement {
    sid       = "GetAuthToken"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PushImages"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
    ]
    resources = [
      var.backend_repository_arn,
      var.frontend_repository_arn,
    ]
  }

  statement {
    sid     = "SendDeployCommand"
    actions = ["ssm:SendCommand"]
    resources = [
      "arn:aws:ec2:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:instance/${var.instance_id}",
      "arn:aws:ssm:${data.aws_region.current.name}::document/AWS-RunShellScript",
    ]
  }

  statement {
    sid     = "ReadCommandStatus"
    actions = ["ssm:GetCommandInvocation"]
    resources = [
      "arn:aws:ec2:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:instance/${var.instance_id}",
    ]
  }
}

resource "aws_iam_role_policy" "codebuild" {
  name   = "codebuild"
  role   = aws_iam_role.codebuild.id
  policy = data.aws_iam_policy_document.codebuild.json
}

# --- project --------------------------------------------------------------

resource "aws_codebuild_project" "app" {
  name          = "${local.name}-build"
  service_role  = aws_iam_role.codebuild.arn
  build_timeout = 30

  # The buildspec clones the repo itself (public HTTPS, no creds) — this
  # avoids GitHub-OAuth/CodeConnections plumbing entirely.
  source {
    type      = "NO_SOURCE"
    buildspec = file("${path.module}/buildspec.deploy.yml")
  }

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    type                        = "LINUX_CONTAINER"
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode             = true # required for docker build

    environment_variable {
      name  = "REPO_URL"
      value = var.repo_url
    }

    environment_variable {
      name  = "ECR_REGISTRY"
      value = var.ecr_registry
    }

    environment_variable {
      name  = "ECR_BACKEND_REPO"
      value = var.ecr_backend_repo
    }

    environment_variable {
      name  = "ECR_FRONTEND_REPO"
      value = var.ecr_frontend_repo
    }

    environment_variable {
      name  = "INSTANCE_ID"
      value = var.instance_id
    }
  }
}
