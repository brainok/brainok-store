# Account roles

The website has a single site admin email:

```txt
brainok777@gmail.com
```

## Admin account

Admins can:

- Edit `Apps -> Site settings`.
- Create and update all app listings, including apps created before the single
  admin email was introduced.
- Upload thumbnails, demo videos, installers, and docs.
- Search licenses and view license holders.
- Generate universal Brainok licenses.
- Reset a licensed device.
- Disable a license.

To seed the admin, sign in once with `brainok777@gmail.com`. The backend will
set `accountRole: "admin"` for that email. You can also confirm the Firestore
user document:

```json
{
  "accountRole": "admin",
  "accessStatus": "active",
  "inviteQuota": 50
}
```

Only `brainok777@gmail.com` can be admin. Other users remain normal users even
if someone manually writes `accountRole: "admin"` to their document; the backend
will normalize them back to `accountRole: "user"` when their profile is ensured.
`accessStatus: "active"` and `inviteQuota` do not make a user an admin.

## Normal user account

Normal users should stay:

```json
{
  "accountRole": "user",
  "accessStatus": "pending",
  "inviteQuota": 0
}
```

They can:

- Browse public app listings.
- Download public installers.
- Use a 30-day desktop trial.
- Enter one Brainok license inside the desktop app after the trial.

They cannot upload apps, edit the site, or manage licenses.
