# PDRS – How to Start the Project

This project is a **Personalized Diet Recommendation System (PDRS)** with three parts:

| Part | Tech | Purpose |
|------|------|---------|
| **client** | React + Vite + Tailwind | Frontend (sign up, preferences, diet recommendations) |
| **server** | Node.js + Express + MongoDB | Backend API (auth, user preferences, DB) |
| **ml-model-service** | Python + FastAPI | ML diet recommendation engine |

---

## Quick start (minimal: frontend + backend)

To run the app without the ML service (auth and preferences will work):

### 1. Backend (server)

```powershell
cd C:\Users\amanv\Desktop\Final-Year-Project---PDRS\server
```

- **Create env file**  
  Copy `.env.sample` to a file named `env` in the **project root** (one level up from `server`), because the server loads `../env`:

  ```powershell
  copy .env.sample ..\env
  ```

  Then edit `env` (in the project root) and set:

  - `MONGODB_SRV` – your MongoDB connection string (e.g. from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
  - `CORS_ORIGIN` – frontend URL, e.g. `http://localhost:5173`
  - `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` – any long random strings
  - `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY` – e.g. `1d` and `7d`
  - Cloudinary keys if you use profile image upload (optional)

- **Install and run**

  ```powershell
  npm install
  npm run dev
  ```

  Server runs at **http://localhost:8000**.

### 2. Frontend (client)

Open a **new** terminal:

```powershell
cd C:\Users\amanv\Desktop\Final-Year-Project---PDRS\client
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**.  
API calls to `/api` are proxied to `http://localhost:8000` by Vite.

---

## Optional: ML service (diet recommendations)

The backend can call the ML service for personalized food recommendations. To run it:

```powershell
cd C:\Users\amanv\Desktop\Final-Year-Project---PDRS\ml-model-service
python -m venv venv
.\venv\Scripts\activate
pip install fastapi uvicorn pandas numpy scikit-learn joblib pydantic
uvicorn app:app --reload --port 8001
```

ML API will be at **http://localhost:8001** (e.g. `POST /predict/foods`).

**Important:** The code expects:

- `ml-model-service/diet_model.pkl` – trained model (currently you have `Older models/diet_model_personalized.pkl`; copy or rename as needed).
- `ml-model-service/raw_data/final_df_cleaned.csv` – cleaned food dataset. This file is not in the repo; you need to add it (or point the code to your actual CSV path).

Until the server’s personalization service is wired to this URL (e.g. via `ML_SERVICE_URL` in server env), diet recommendations may not use the ML service even when it’s running.

---

## Summary: order to start

1. **MongoDB** – Create a cluster (e.g. Atlas), get connection string, put it in `env`.
2. **Server** – Create `env` from `.env.sample`, then `npm install` and `npm run dev` in `server`.
3. **Client** – `npm install` and `npm run dev` in `client`.
4. **Browser** – Open **http://localhost:5173** and use the app.
5. **(Optional)** – Set up `diet_model.pkl` and `final_df_cleaned.csv`, then run the ML service on port 8001 if you need live diet recommendations from the model.

---

## Ports

| Service | Port | URL |
|---------|------|-----|
| Client (Vite) | 5173 | http://localhost:5173 |
| Server (Express) | 8000 | http://localhost:8000 |
| ML service (FastAPI) | 8001 | http://localhost:8001 |

---

## Troubleshooting

- **“MongoDB connection failed”** – Check `MONGODB_SRV` in `env` and that the file is in the project root (so `../env` from `server` finds it).
- **CORS errors** – Set `CORS_ORIGIN=http://localhost:5173` in `env`.
- **Server can’t find env** – Ensure the env file is named `env` and placed at `Final-Year-Project---PDRS\env` (parent of `server`). Alternatively you can change `server/src/index.js` to use `path: ".env"` and keep a `.env` file inside the `server` folder.
