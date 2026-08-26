# What CI needs to know about this environment.
#
# Published rather than written down in a workflow: a project id is generated when the project is
# created, so the only copy that cannot drift is the one the apply that created it publishes.

data "github_repository" "this" {
  full_name = "${module.config.gh_organization_name}/${module.config.project_name}"
}

# The environment a deploy job names to get these values — and where a required reviewer would be
# configured, if production ever wants one.
resource "github_repository_environment" "this" {
  repository  = data.github_repository.this.name
  environment = local.environment
}

resource "github_actions_environment_variable" "gcp_project_id" {
  repository    = data.github_repository.this.name
  environment   = github_repository_environment.this.environment
  variable_name = "GCP_PROJECT_ID"
  value         = local.gcp_project_id
}
