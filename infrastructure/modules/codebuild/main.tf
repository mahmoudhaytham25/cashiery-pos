# One parameterized build project per environment, same module:
#   dev  — buildspec.deploy.yml:  clones the repo, builds+pushes changed
#          service images to ECR, then redeploys the box over SSM.
#   prod — buildspec.promote.yml: retags the dev-verified manifests
#          (batch-get-image + put-image, NO rebuild) and redeploys.
# The GitHub Actions deploy jobs pick the project and pass the env overrides
# (GIT_REF/IMAGE_TAG/CHANGED_SERVICES for dev, PROMOTE_FROM_TAG/IMAGE_TAG for
# prod). The SSM redeploy block is shared — assets/ssm-redeploy.sh is injected
# into both buildspecs via templatefile().

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

  # Promotion reads manifests instead of rebuilding (batch-get-image →
  # put-image), and the deploy buildspec reuses them to carry the stack tag
  # onto services that didn't change in a push.
  statement {
    sid = "ReadImages"
    actions = [
      "ecr:BatchGetImage",
      "ecr:DescribeImages",
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

  # The deploy buildspec clones the repo itself (public HTTPS, no creds) —
  # this avoids GitHub-OAuth/CodeConnections plumbing entirely. The promote
  # buildspec never clones; it only copies ECR manifests.
  source {
    type = "NO_SOURCE"
    buildspec = templatefile("${path.module}/${var.buildspec_file}", {
      # Shared SSM redeploy block — keep the indent in step with the
      # `${ssm_redeploy}` line's depth inside the yaml block scalar.
      ssm_redeploy = indent(8, chomp(file("${path.module}/assets/ssm-redeploy.sh")))
    })
  }

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    type                        = "LINUX_CONTAINER"
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode             = var.privileged # docker build needs it; promote (retag-only) doesn't

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
