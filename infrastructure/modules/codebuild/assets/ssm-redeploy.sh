# Redeploy the app box over SSM: pull the repo (compose file), pin IMAGE_TAG
# in .env, docker-login to ECR, compose pull + up.
#
# This file is rendered INLINE into each buildspec by Terraform
# (templatefile + indent) — there is no script file to source at build time.
# Keep variables in $VAR form: dollar-brace syntax would be eaten by
# Terraform's interpolation at render time.
#
# Reads: IMAGE_TAG, AWS_DEFAULT_REGION, ECR_REGISTRY, INSTANCE_ID.

set -e

params=$(printf '{"commands":[
  "set -e",
  "cd /opt/cashiery-pos",
  "git pull --ff-only",
  "sed -i s/^IMAGE_TAG=.*/IMAGE_TAG=%s/ .env",
  "aws ecr get-login-password --region %s | docker login --username AWS --password-stdin %s",
  "docker compose -f docker-compose.prod.yml pull",
  "docker compose -f docker-compose.prod.yml up -d"
]}' "$IMAGE_TAG" "$AWS_DEFAULT_REGION" "$ECR_REGISTRY" | tr -d '\n')

cmd=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "deploy $IMAGE_TAG" \
  --parameters "$params" \
  --query 'Command.CommandId' --output text)
echo "ssm command: $cmd"

while :; do
  st=$(aws ssm get-command-invocation --command-id "$cmd" --instance-id "$INSTANCE_ID" --query 'Status' --output text)
  case "$st" in Pending|InProgress|Delayed) sleep 5 ;; *) break ;; esac
done
echo "ssm -> $st"
[ "$st" = "Success" ]
