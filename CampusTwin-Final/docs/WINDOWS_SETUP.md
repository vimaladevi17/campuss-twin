# Windows setup (beginner steps)

You need Node.js 20 or newer (nodejs.org, LTS), a MongoDB database (a free MongoDB Atlas cluster works), and optionally Python 3.10+ for the GIS pipeline.
Open PowerShell in the project folder (right-click the folder in File Explorer, "Open in Terminal").

## 1. Server
```powershell
cd server
Copy-Item .env.example .env
notepad .env
```
Fill `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Make a secret with:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Never paste these values into chat, screenshots or Git.
```powershell
npm install
npm run seed                 # creates the first admin account only
npm run migrate:dry          # preview, changes nothing
npm run migrate
npm run import:facilities -- ..\data\KARE_Campus_Facilities_Spatial_Data.xlsx            # dry run
npm run import:facilities -- ..\data\KARE_Campus_Facilities_Spatial_Data.xlsx --commit
npm run validate:startup     # checks the server, sockets and (with MONGO_URI) the database
npm start                    # http://localhost:5000
```

## 2. Client (second PowerShell window)
```powershell
cd client
Copy-Item .env.example .env
npm install
npm run dev                  # http://localhost:5173
```

## 3. Optional: GIS data
See `docs/GIS_PIPELINE.md`. Without it the map shows the Excel facilities and the replacement engine reports walking distance as unavailable.

## 4. Optional: DEMO data
`cd server`, then `npm run seed:twin-demo -- ..\data\KARE_Campus_Facilities_Spatial_Data.xlsx`. Remove with `node scripts/seedTwinDemo.js --reset`. All such records show a DEMO badge.

## 5. Tests and production build
```powershell
cd server; npm test; cd ..
cd client; npm test; npm run build; cd ..
cd gis; python -m pytest -q; cd ..
```
or run `scripts\test-all.ps1` from the project folder.
