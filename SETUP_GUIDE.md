# ALEJO System Setup Guide

## Permanent PATH Configuration

### Step 1: Open System Properties

1. Press `Win + R`
2. Type `sysdm.cpl`
3. Press Enter

### Step 2: Configure Environment Variables

1. Go to "Advanced" tab
2. Click "Environment Variables"
3. Under "System variables", select "Path"
4. Click "Edit"

### Step 3: Add Required Paths

```text
C:\Program Files\nodejs
C:\Users\magic\AppData\Local\Programs\Python\Python311
```

### Step 4: Verification

Open PowerShell and run:

```powershell
node --version
npm --version
python --version
```

## Starting the Development Server

```powershell
cd C:\Users\magic\CascadeProjects\ALEJO
npm run dev
```

## Accessing the UI

1. Open browser
2. Go to <http://localhost:3000>

## Unreal Engine Features

Your UI now includes:

- Photorealistic avatar rendering
- Dynamic lighting with Lumen
- Nanite virtualized geometry
- Real-time global illumination
- Cinematic-quality materials

![UI Preview](https://example.com/alejo-ui-preview.jpg)

## Support

Contact <support@apintodesign.co> for assistance
