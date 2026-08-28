# The organization forbids IAM members outside its own domain, which is the right default and the
# wrong one for a service the public is meant to reach: `allUsers` on the Cloud Run services is
# refused with "one or more users named in the policy do not belong to a permitted customer".
#
# Relaxed for this project alone, and here rather than in the stacks that grant the bindings:
# loosening an organization policy is exactly the kind of privilege root infra exists to hold and
# CI is not given.

resource "google_org_policy_policy" "allow_all_iam_members" {
  provider = google.quota_override

  name   = "projects/${local.gcp_project_id}/policies/iam.allowedPolicyMemberDomains"
  parent = "projects/${local.gcp_project_id}"

  spec {
    rules {
      allow_all = "TRUE"
    }
  }

  depends_on = [google_project_service.apis["orgpolicy.googleapis.com"]]
}
