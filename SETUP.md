# Setup from zero (Windows)

This takes you from an empty Windows computer to your first DelftRate briefing. It takes about 20 minutes. Every command goes into **Command Prompt**: press the Windows key, type `cmd`, press Enter.

On a Mac the steps are the same, but install the tools with [Homebrew](https://brew.sh) (`brew install git gh` and `brew install --cask claude-code`) and skip step 3.

## Before you start

You need three accounts:

- **GitHub.** Create one at [github.com/signup](https://github.com/signup) if you have none.
- **Your username sent to Oleg.** He adds it to the team list and you get an invitation by email. Without this step the project does not know who you are.
- **A paid Claude account** (Pro, Max, Team or Console). The free claude.ai plan does not include Claude Code.

## 1. Install Git

```
winget install --id Git.Git -e
```

Git keeps the history of the code. Claude Code also uses the Git Bash that comes with it.

## 2. Install the GitHub CLI

```
winget install --id GitHub.cli -e
```

This gives you the `gh` command, which our scripts use to read tasks and pull requests.

## 3. Install Python

Type this and press Enter:

```
python3
```

If Python is missing, the Microsoft Store opens on the Python page. Press **Get**. Install it this way and not from python.org, because our scripts call `python3` and only the Store version adds that command.

## 4. Install Claude Code

```
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

It shows no progress while it downloads; wait for it to finish. You do not need to run it as Administrator.

## 5. Close cmd and open it again

The new commands only work in a new window. Check all four:

```
git --version
gh --version
python3 --version
claude --version
```

Each line should print a version number. If one says "is not recognized", repeat its install step and open a new window again.

## 6. Sign in to GitHub — this is how you select who you are

```
gh auth login
```

Answer the questions like this:

1. Where do you use GitHub? **GitHub.com**
2. Preferred protocol? **HTTPS**
3. Authenticate Git with your GitHub credentials? **Yes**
4. How would you like to authenticate? **Login with a web browser**

Copy the code it shows, press Enter, paste the code in the browser and approve.

There is no user menu in DelftRate. The project reads the account you signed in with here and looks it up in the team list, so sign in with the same username you sent to Oleg. To check which account is active:

```
gh api user -q .login
```

## 7. Accept the invitation

Open [github.com/olezheeee/delftrate/invitations](https://github.com/olezheeee/delftrate/invitations) and press **Accept invitation**. The same link is in the email from GitHub. If the page says there is no invitation, Oleg has not added your username yet.

## 8. Download the project

```
cd %USERPROFILE%\Documents
gh repo clone olezheeee/delftrate
cd delftrate
```

The project is now in `Documents\delftrate`.

## 9. Start Claude Code

Always start it from inside the project folder:

```
claude
```

The first time, a browser opens: sign in with your Claude account. Then Claude asks whether you trust the folder; answer yes.

## 10. Run your first briefing

Inside Claude Code, type:

```
/start-session
```

The second line must show your name and role, for example `Signed in as Ariv (Coder)`. Below it you see the overall progress, the last changes and your own tasks. Leads also see the whole team.

If it shows `@yourusername (not in .github/team.json yet)`, you are signed in to GitHub with an account that is not on the team list. Send Oleg the username from step 6, or sign in with the right one:

```
gh auth logout
gh auth login
```

## Every day after this

```
cd %USERPROFILE%\Documents\delftrate
claude
```

Then `/start-session`. To open a task of your own, type `/new-task` followed by what you are going to do. How tasks, branches and reviews work is in [CONTRIBUTING.md](CONTRIBUTING.md).

## If something goes wrong

| What you see | What to do |
|---|---|
| `'winget' is not recognized` | Install **App Installer** from the Microsoft Store, then open a new cmd window. |
| `The token '&&' is not a valid statement separator` | You are in PowerShell. Open `cmd` instead. |
| `'claude' is not recognized` after installing | Close every cmd window and open a new one. |
| `python3` opens the Store every time | Python is not installed yet. Press **Get** in the Store. |
| `gh repo clone` says the repository was not found | Accept the invitation in step 7 first. |
| `/start-session` is an unknown command | You started `claude` outside the project folder. Leave with `/exit`, run `cd %USERPROFILE%\Documents\delftrate`, start again. |
