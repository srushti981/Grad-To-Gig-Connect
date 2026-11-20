<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Signed-in screens live under `src/routes/_authenticated/` (client-only gate redirects to `/`, which is the sign-in/sign-up landing); role-specific dashboards are components in `src/components/app/` chosen by the user's primary role — keeps one URL per screen for all roles.
