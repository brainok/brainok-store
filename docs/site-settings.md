# Site settings

The public homepage text can be edited from the web app without touching code.

## Where to edit

1. Open the Netlify site or local Vite site.
2. Sign in with the admin account.
3. Open `Apps`.
4. Expand `Site settings`.
5. Edit the fields and click `Save site settings`.

## Editable fields

- Brand name and mark
- Hero eyebrow, title, and description
- Primary and secondary button labels
- Download page title, subtitle, and body text

The values are stored in Firestore at:

```txt
/site/public
```

Public users can read this document. Only the Firebase Function `updateSiteSettings`
can write it, and it only allows `brainok777@gmail.com`.
