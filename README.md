# n8n-nodes-linkedin-company-employees-api

An [n8n](https://n8n.io/) community node that lists the people who work at a company, from LinkedIn's public pages: name, job title, location, and profile URL, with each person checked against their public profile to confirm they still work there. Give it LinkedIn company URLs or company names, and narrow the list by job title and location. It is backed by the [LinkedIn Company Employees API](https://apify.com/johnvc/linkedin-company-employees-api?fpr=9n7kx3) on [Apify](https://apify.com?fpr=9n7kx3) and bills per person returned, so there are no subscriptions and no minimums. No LinkedIn account, login, or cookie is needed.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Output](#output) · [Example workflows](#example-workflows) · [Pricing](#pricing) · [Resources](#resources)

## What it does

Give the node one or more companies, and it returns one item per person who works there. All the companies on one input item are collected in a single Actor run. It also works as an **AI Agent tool**, so an agent can look up who works where on demand.

- Build a company employee list from a LinkedIn company URL or just the company name
- Narrow to the roles you care about with job title keywords ("head of", "engineer", "recruiter") and locations
- Confirm current employment: each person's public profile is opened and checked for a current role at the company, so people who left are not returned
- Get the full public profile for verified people: about text, work history, education, follower count
- Handle up to 50 companies and up to 1,000 people per company in one run
- Choose how much data to return per person: Simplified, Raw, or Selected Fields

Typical uses: account-based prospecting (list the decision makers at your target accounts), recruiting and talent mapping (see who is on a competitor's team, and where), org charts and market maps, and CRM hygiene (check that your contacts still work at the account).

## Installation

Follow the n8n [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/):

1. In n8n, open **Settings > Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-linkedin-company-employees-api` as the npm package name.
4. Agree to the risks of using community nodes, then select **Install**.

After it installs, the **LinkedIn Company Employees** node appears in the nodes panel.

> n8n Cloud only allows verified community nodes, so install this node on a self-hosted n8n instance.

## Credentials

You need a free [Apify account](https://apify.com?fpr=9n7kx3) and an API token.

1. Sign in to the [Apify Console](https://console.apify.com?fpr=9n7kx3).
2. Open **Settings > Integrations** and copy your **Personal API token**.
3. In n8n, create a new **Apify API** credential and paste the token.
4. Use the credential's **Test** button to confirm it works.

The node also supports **Apify OAuth2** if you prefer to connect that way.

## Operations

**Employee > Get Many** lists the people who work at one or more companies and returns one item per person.

| Parameter | Description |
| --- | --- |
| Companies | LinkedIn company URLs (`https://www.linkedin.com/company/microsoft`) or company names (`Microsoft`). A URL is exact; a name is matched to its LinkedIn company page first. Required. Up to 50 per run. |
| Job Title Keywords | Return only people whose public page mentions one of these job titles, for example `engineer`, `sales`, or `head of marketing`. Each keyword also runs its own search, which reaches more people at large companies. Leave empty to search built-in role slices. Up to 20. |
| Locations | Return only people in these cities, regions, or countries, for example `Dublin` or `United States`. Leave empty to search everywhere. Up to 10. |
| Max Employees per Company | Stop after returning this many people for each company (1 to 1,000, default 100). You are charged only for people actually returned. |
| Verify Employment | On (default): open each person's public profile and confirm a current role at the company, adding title, location, work history, education, and photo. Off: a faster, cheaper list with search-level data only (name, headline, profile URL). |
| Options > Max Search Slices per Company | Cap on the public searches run per company (1 to 100, default 40). Each slice returns about ten people, so more slices reach more of a large company. |
| Options > Max Cached Result Age (Days) | Serve results fetched within this many days from the shared cache (0 to 90). 0 always fetches fresh. Leave the option out to keep the default for each record type. |
| Output | How much data to return: Simplified, Raw, or Selected Fields. |

### Coverage: what to expect

The API finds people through public search results and then checks them against LinkedIn, so it returns the people search engines have indexed, not a company's full headcount. Smaller companies get the highest coverage. For a company with tens of thousands of employees, expect hundreds of people, not thousands: add **Job Title Keywords** and **Locations** to get the slice you need, or raise **Max Search Slices per Company**. Each run also writes a `RUN_SUMMARY` record with the coverage per company to the run's key-value store on Apify (it is not part of the node's output).

## Output

Each person is returned as its own n8n item. A company that cannot be matched or searched returns one item with `result_type` set to `error` (never charged), so you can see which inputs to fix. The API returns more than ten fields per person, so the **Output** parameter lets you choose how much to return:

- **Simplified** (default): a compact object with `result_type`, `fullName`, `currentTitle`, `headline`, `companyName`, `location`, `verified`, and `profileUrl`. For an error item it returns `result_type`, `requestedCompany`, `error_type`, and `error_message`. This mode is also used automatically when the node runs as an AI Agent tool, to keep responses small.
- **Raw**: every field the API returns for each person, using the original field names below.
- **Selected Fields**: pick exactly which fields to include.

A Simplified item looks like this (synthetic example):

```json
{
  "result_type": "employee",
  "fullName": "Sam Sample",
  "currentTitle": "Senior Software Engineer",
  "headline": "Senior Software Engineer at Example Co",
  "companyName": "Example Co",
  "location": "Dublin, Ireland",
  "verified": true,
  "profileUrl": "https://www.linkedin.com/in/sam-sample-0000"
}
```

### Fields (Raw and Selected Fields)

| Field | Type | Description |
| --- | --- | --- |
| `result_type` | string | `employee` (one person at a requested company) or `error` (a company that could not be resolved or searched, never charged) |
| `companyName` | string | Name of the company this person was found for |
| `companySlug` | string | The company's LinkedIn handle, the last part of its company page URL |
| `companyUrl` | string | The company's public LinkedIn page |
| `profileUrl` | string | Public LinkedIn profile URL, with tracking parameters removed |
| `slug` | string | The profile's public identifier. Stable per person and a good key for removing duplicates or comparing runs |
| `fullName` | string | The person's name as shown on their public profile or search result |
| `headline` | string | The professional headline shown under the person's name |
| `location` | string | City or area from the public profile, when the profile was opened |
| `currentTitle` | string | Job title of the person's current role; for a verified person, the role at this company |
| `currentCompany` | string | Employer of the current role |
| `verified` | boolean or null | `true` when the public profile confirms a current role at this company; `null` when the profile was not opened (Verify Employment off, or a per-company limit was reached) or could not be opened |
| `matchReason` | string | How employment was decided: `current-position`, `current-company`, `company-name`, `profile-unavailable`, `not-checked`, or `search-experience` |
| `foundBy` | string | The public search that found this person, or `company-page` for people listed on the company's own page |
| `fromCache` | boolean | `true` when the row was served from the shared result cache |
| `fetched_at` | string | ISO 8601 UTC timestamp of when the data behind this row was fetched |
| `about` | string | The person's public About text. Verified rows only |
| `positions` | array | Work history: every position on the public profile, with title, company, dates, location, and whether it is current. Verified rows only |
| `education` | array | Schools on the public profile, with dates where shown. Verified rows only |
| `followers` | integer | Follower count on the public profile. Verified rows only |
| `connections` | integer | Connection count on the public profile (LinkedIn caps the public number at 500). Verified rows only |
| `photoUrl` | string | Public profile photo, when the person has one. Verified rows only |
| `memberId` | string | LinkedIn's numeric member id. Verified rows only |
| `requestedCompany` | string | Error rows only: the company entry the row is about, exactly as given |
| `error_type` | string | Error rows only: `CompanyNotFound`, `CompanyPageUnavailable`, `SearchUnavailable`, or `InvalidInput` |
| `error_message` | string | Error rows only: why the row is an error, in plain words |

Email addresses and phone numbers are not on LinkedIn's public pages, so the node does not return them.

## Example workflows

### 1. Map the decision makers at your target accounts

1. **Google Sheets**: read your target account list (one company URL or name per row).
2. **LinkedIn Company Employees**: Companies `{{ $json.company }}`, Job Title Keywords `head of`, `director`, `vp`, Max Employees per Company `25`.
3. **Google Sheets** or your CRM node: append `fullName`, `currentTitle`, `companyName`, `location`, and `profileUrl` for each person.

### 2. Map a competitor's team for recruiting

1. **Manual Trigger**.
2. **LinkedIn Company Employees**: add the competitor's LinkedIn URL, Job Title Keywords `data engineer`, Locations `Dublin`, Output `Selected Fields` with `fullName`, `currentTitle`, `location`, `positions`, `education`, and `profileUrl`.
3. **Airtable**: create one record per person for your sourcing pipeline.

### 3. Watch who joins and who leaves each month

1. **Schedule Trigger**: once a month.
2. **LinkedIn Company Employees**: the companies you track, Output `Selected Fields` with `slug`, `fullName`, `currentTitle`, and `profileUrl`.
3. **Compare Datasets**: compare this month's people with last month's list on `slug`.
4. **Slack**: post the people who appeared and the people who dropped off.

### 4. Let an AI Agent look up a team

1. **AI Agent** node.
2. Attach **LinkedIn Company Employees** as a tool.
3. Ask "Who are the engineering leaders at linkedin.com/company/stripe in Dublin?" The agent calls the node (in Simplified mode) and answers from the returned people.

## Pricing

This node calls the [LinkedIn Company Employees API](https://apify.com/johnvc/linkedin-company-employees-api?fpr=9n7kx3) on Apify, which is billed **pay-per-result** with no subscription and no minimums. You pay per person returned, never per search: a verified person (profile confirms a current role) or a found person (search-level row, when Verify Employment is off or a profile could not be opened), never both for the same person. Error rows and people dropped as former employees are free. Apify's free plan includes monthly platform credits for trying it out. See the [Actor page](https://apify.com/johnvc/linkedin-company-employees-api?fpr=9n7kx3) for current rates.

## Related nodes

Part of a suite of LinkedIn APIs for n8n that read only LinkedIn's public pages, with no login and no cookies:

- [n8n-nodes-linkedin-company-api](https://www.npmjs.com/package/n8n-nodes-linkedin-company-api): company firmographics (size, industry, headquarters, followers)
- [n8n-nodes-linkedin-profile-api](https://www.npmjs.com/package/n8n-nodes-linkedin-profile-api): full public profiles from profile URLs
- [n8n-nodes-linkedin-jobs-api](https://www.npmjs.com/package/n8n-nodes-linkedin-jobs-api): the roles a company is hiring for
- [n8n-nodes-linkedin-posts-api](https://www.npmjs.com/package/n8n-nodes-linkedin-posts-api): posts from profiles and companies

## Resources

- [LinkedIn Company Employees API on Apify](https://apify.com/johnvc/linkedin-company-employees-api?fpr=9n7kx3)
- [npm package](https://www.npmjs.com/package/n8n-nodes-linkedin-company-employees-api)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Apify n8n integration guide](https://docs.apify.com/platform/integrations/n8n)

## License

[MIT](LICENSE.md)
