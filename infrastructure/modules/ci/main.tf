# GitHub Actions OIDC — lets the deploy jobs authenticate via a short-lived
# role session. No AWS keys are stored in GitHub; the role is assumable only
# by workflows running on the configured repo's deploy branches (main +
# develop by default — one role serves the whole promotion pipeline).
#
# All heavy lifting (clone, docker build, ECR push/retag, SSM redeploy) lives
# in the CodeBuild projects — this role only triggers and polls them.

locals {
  name = "${var.project}-${var.environment}"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      # Branch runs claim `ref:refs/heads/<branch>`; jobs that set
      # `environment:` claim `environment:<name>` instead of a ref — both
      # shapes must be trusted or the prod promote job can't assume the role.
      values = concat(
        [for b in var.deploy_branches : "repo:${var.github_repo}:ref:refs/heads/${b}"],
        [for e in var.deploy_environments : "repo:${var.github_repo}:environment:${e}"],
      )
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${local.name}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "RunBuilds"
    actions   = ["codebuild:StartBuild"]
    resources = var.codebuild_project_arns
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
