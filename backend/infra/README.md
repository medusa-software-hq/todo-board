# Backend infrastructure

The API's Cloud Run service and its identity.

Applied by CI, per environment, as the service account root infra created:

```bash
terraform workspace select prod   # or: staging
terraform apply
```

The image is a placeholder until a deploy replaces it; Terraform deliberately stops owning it after
the service exists.
