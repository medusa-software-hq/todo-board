# Main infrastructure

An environment: its own GCP project, the API's and the web app's Cloud Run services, and the IAM
that lets CI/CD deploy here and lets this project pull from the shared registry.

One configuration, one state prefix, one environment per Terraform workspace:

```bash
terraform workspace select prod      # or: staging
terraform apply
```

There is no `default` workspace — an environment is chosen deliberately or not at all. Terraform
run without one fails on the environment lookup, which is the intended outcome rather than something
to be caught and reworded.

Applied after `infra/shared`, whose state it reads for the registry and the CI/CD identity.
