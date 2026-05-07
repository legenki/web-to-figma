# Check PR review

Check the PR for this branch on GitHub, read the code review feedback, and decide — from first principles — what's actually worth fixing.

## Instructions

- Find the PR for the current branch (`gh pr view --json number,url,title,headRefName`). If there is no PR, bail and explain.
- Pull review feedback from every source:
  - PR-level reviews: `gh pr view <num> --json reviews`
  - Inline review comments: `gh api repos/{owner}/{repo}/pulls/<num>/comments`
  - Issue/PR conversation comments: `gh api repos/{owner}/{repo}/issues/<num>/comments`
- Group multiple comments on the same line/topic together — treat them as one issue.
- Skip resolved/outdated threads and your own prior replies. Skip pure approvals ("LGTM").
- For each remaining point, **read the actual code at the referenced file/line** before judging. Do not trust the reviewer's characterization of the code; verify it.

## How to judge each point

Think from first principles. For each comment, ask:

1. **Is it factually correct?** Does the code actually do what the reviewer claims? (Bots and humans both hallucinate.)
2. **Does it matter?** Is the impact real (correctness, security, perf, UX) or theoretical / stylistic?
3. **Is it consistent with the codebase?** A suggestion that contradicts the existing patterns in this repo is usually wrong for *this* repo, even if it's a "best practice" elsewhere.
4. **What's the cost vs. benefit?** A 30-line refactor to satisfy a nit is not worth it. A 1-line fix for a real bug is.

Then bucket each point into exactly one of:

- **fix** — accurate and worth doing now
- **defer** — accurate but low value / out of scope for this PR
- **reject** — false positive, wrong about the code, contradicts repo conventions, or premature abstraction / over-engineering

Bias toward **reject** for: extra defensive checks in trusted codepaths, comments restating what code does, "consider extracting" / "consider splitting" suggestions on code that isn't reused, generic best-practice advice that ignores local context, type-safety nits already handled by upstream validation.

Bias toward **fix** for: real bugs, security issues, accessibility regressions, broken types, incorrect logic, missing error handling at system boundaries, anything user-visible that's actually wrong.

## Output

Report a table or list, one row per point:

- File:line (or "general" for PR-level)
- One-sentence summary of the comment
- Verdict: `fix` / `defer` / `reject`
- One-sentence reasoning grounded in the actual code, not the comment

Then ask me which of the `fix` items you should address. **Do not start editing code until I confirm.**
