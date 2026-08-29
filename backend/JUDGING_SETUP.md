# LifeHack 2026 judging portal setup

The judging portal is hosted inside the existing Google Apps Script web app.
It reads teams from `Main`, reads judge credentials from `Judge Allotment`, and
writes one row per judge/team to `Judging Results`.

The current scoring form records:

- Overall score from 0 to 100
- Optional comments

A judge may edit a saved score. The existing result row is updated rather than
duplicated.

## Category mapping

The judge workbook assigns sponsor/problem statements, while `Main` stores the
three main-track categories. The backend uses this mapping:

| Judge allotment value | Main `ProblemStatementID` |
| --- | --- |
| Rezolve AI | Consumerism |
| Visa | Digital payments |
| EcoVolt | Sustainability |

## 1. Put the latest main-track data in the Google Sheet

Use the same Google Sheet that already contains the live `Main` registration
tab and the Apps Script check-in backend.

Confirm that `Main` contains these columns:

- `Name`
- `TeamCode`
- `TeamName`
- `ProblemStatementID`

Every team to be judged needs a team code and one of the three exact category
values shown above. Do not use the downloaded Excel file as the live judging
database; it is only a snapshot.

## 2. Add the judge allotment tab

1. Open `judge_allotment.xlsx` in Excel.
2. In the registration Google Sheet, add a tab named exactly `Judge Allotment`.
3. Copy the judge table into that tab. It may begin on row 1 or retain the title
   and blank rows from the Excel file; the script locates the header row.
4. Keep these exact column headers:
   - `Problem Statement`
   - `Judge Type`
   - `Judge Name`
   - `Username`
   - `Password`
5. Do not share this tab with participants. It contains judge passwords.

An optional `Active` column is supported. Set it to `FALSE` to disable a judge.
A blank value is treated as active.

## 3. Add the portal code to Apps Script

1. In the registration Google Sheet, select **Extensions → Apps Script**.
2. Replace the complete `Code.gs` with this repository's `backend/Code.gs`.
3. Select **+ → HTML**, name the file exactly `Judge`, and paste the complete
   contents of `backend/Judge.html`.
4. Save the Apps Script project.

## 4. Create and validate the results sheet

1. In the Apps Script function dropdown, select `setupJudgingPortal`.
2. Click **Run** and approve permissions if Google asks.
3. Open the execution log. The expected summary from the reviewed workbooks is:
   - 7 judges
   - 90 teams
   - Consumerism: 2 judges and 30 teams
   - Digital payments: 3 judges and 30 teams
   - Sustainability: 2 judges and 30 teams
4. Confirm that a new tab named `Judging Results` was created.

If the counts are different, stop and correct the Google Sheet before sending
the portal link to judges.

## 5. Redeploy the existing check-in Apps Script web app

Use the Apps Script project attached to the live registration Sheet—the same
project and public web-app deployment already used by the working check-in
scanner. Do not create a separate Apps Script project for judging.

1. Select **Deploy → Manage deployments** in that existing project.
2. Edit the working check-in web-app deployment.
3. Select **New version**.
4. Keep **Execute as: Me** and **Who has access: Anyone**.
5. Click **Deploy**.
6. Keep the resulting `/exec` URL.

No GitHub or main-website redeployment is required for this judging portal.

The judge URL is the Apps Script URL with `?page=judge`, for example:

```text
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?page=judge
```

The production LifeHack website also redirects its short judge route to this
portal when `VITE_JUDGE_PORTAL_URL` is configured:

```text
https://lifehack2026.nuscomputing.com/?page=judge
```

After changing `VITE_JUDGE_PORTAL_URL`, rebuild and redeploy the main website.

## 6. Test before sharing

1. Open the judge URL in an incognito/private browser window.
2. Log in using one Rezolve AI judge account.
3. Confirm that exactly the 30 Consumerism teams appear.
4. Save a test score for one team.
5. Confirm that one row appears in `Judging Results` with that judge, team,
   category, score, comments, and timestamps.
6. Edit the same score and confirm the same row updates instead of adding a
   duplicate.
7. Repeat with one Visa judge and one EcoVolt judge.
8. Delete the three test result rows after the test.

## Event-day use

1. Give every judge the same `?page=judge` link and their own credentials.
2. Judges log in on a phone, tablet, or laptop.
3. Each judge sees only teams in their assigned category.
4. The judge opens a team, enters the score and comments, and presses **Save
   result**.
5. The organising committee monitors the `Judging Results` tab live.
6. After judging, download the Google Sheet through **File → Download →
   Microsoft Excel (.xlsx)** if an Excel copy is required.

Internet access is required while judges are saving scores. Keep a downloaded
copy of the team list and paper score sheets as the event-day fallback.
