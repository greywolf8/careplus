import uuid
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from supabase import create_client, Client
from careplus.core.config import settings


def get_content_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def seed_patients(supabase: Client) -> List[uuid.UUID]:
    patients_data = [
        {
            "name": "John Smith",
            "date_of_birth": "1980-05-15",
            "preferred_language": "en",
            "phone": "+91-9876543210",
            "email": "john.smith@example.com"
        },
        {
            "name": "राजेश कुमार",
            "date_of_birth": "1975-08-22",
            "preferred_language": "hi",
            "phone": "+91-9876543211",
            "email": "rajesh.kumar@example.com"
        },
        {
            "name": "Priya Sharma",
            "date_of_birth": "1990-03-10",
            "preferred_language": "hi",
            "phone": "+91-9876543212",
            "email": "priya.sharma@example.com"
        },
        {
            "name": "கார்த்திக் ராஜா",
            "date_of_birth": "1985-11-30",
            "preferred_language": "ta",
            "phone": "+91-9876543213",
            "email": "karthik.raja@example.com"
        },
        {
            "name": "Anita Patel",
            "date_of_birth": "1988-07-18",
            "preferred_language": "en",
            "phone": "+91-9876543214",
            "email": "anita.patel@example.com"
        }
    ]

    patient_ids = []
    for patient in patients_data:
        result = supabase.table("patient").insert(patient).execute()
        patient_ids.append(result.data[0]["id"])
        print(f"Created patient: {patient['name']}")

    return patient_ids


def seed_rmps(supabase: Client) -> List[uuid.UUID]:
    rmps_data = [
        {
            "name": "Dr. Arun Gupta",
            "mci_reg_number": "MCI-12345",
            "specialization": "Cardiologist",
            "phone": "+91-9112345678",
            "email": "arun.gupta@hospital.com"
        },
        {
            "name": "Dr. Meera Iyer",
            "mci_reg_number": "MCI-23456",
            "specialization": "Orthopedic Surgeon",
            "phone": "+91-9112345679",
            "email": "meera.iyer@hospital.com"
        },
        {
            "name": "Dr. Suresh Reddy",
            "mci_reg_number": "MCI-34567",
            "specialization": "General Practitioner",
            "phone": "+91-9112345680",
            "email": "suresh.reddy@hospital.com"
        }
    ]

    rmp_ids = []
    for rmp in rmps_data:
        result = supabase.table("rmp").insert(rmp).execute()
        rmp_ids.append(result.data[0]["id"])
        print(f"Created RMP: {rmp['name']}")

    return rmp_ids


def seed_providers(supabase: Client) -> List[uuid.UUID]:
    providers_data = []
    specializations = [
        "Cardiology", "Orthopedics", "General Medicine", "Pediatrics",
        "Neurology", "Gynecology", "Dermatology", "Ophthalmology",
        "ENT", "Psychiatry", "Gastroenterology", "Nephrology",
        "Pulmonology", "Rheumatology", "Endocrinology", "Oncology",
        "Urology", "Anesthesiology", "Radiology", "Pathology"
    ]

    for i, spec in enumerate(specializations):
        providers_data.append({
            "name": f"Dr. Provider {i+1}",
            "mci_reg_number": f"MCI-{40000+i}",
            "specialization": spec,
            "phone": f"+91-9112345{680+i:02d}",
            "email": f"provider{i+1}@clinic.com"
        })

    provider_ids = []
    for provider in providers_data:
        result = supabase.table("rmp").insert(provider).execute()
        provider_ids.append(result.data[0]["id"])
        print(f"Created provider: {provider['name']}")

    return provider_ids


def seed_discharge_summaries(
    supabase: Client,
    patient_ids: List[uuid.UUID],
    rmp_ids: List[uuid.UUID]
) -> List[uuid.UUID]:
    summaries = []

    # Post-CABG cardiac summaries (3)
    cardiac_summaries = [
        {
            "patient_id": patient_ids[0],
            "admitting_rmp_id": rmp_ids[0],
            "raw_content": """
Patient underwent Coronary Artery Bypass Grafting (CABG) on 2024-01-15.
Procedure: 3-vessel CABG using LITA to LAD, saphenous vein grafts to RCA and LCX.
Post-op course: Unremarkable, discharged on day 7.
Medications: Aspirin 75mg OD, Atorvastatin 40mg HS, Metoprolol 25mg BD.
Follow-up: Cardiology review in 2 weeks, wound care daily.
Diet: Low salt, low fat, cardiac rehabilitation recommended.
Activity: Gradual increase, avoid heavy lifting for 6 weeks.
Symptoms to watch: Chest pain, shortness of breath, fever, wound redness.
Emergency contact: Cardiology department +91-9112345678.
            """.strip(),
            "language": "en",
            "discharge_date": "2024-01-22"
        },
        {
            "patient_id": patient_ids[1],
            "admitting_rmp_id": rmp_ids[0],
            "raw_content": """
कोरोनरी आर्टरी बाईपास ग्राफ्टिंग (CABG) 2024-02-01 को किया गया।
प्रक्रिया: LITA से LAD, सेफेनस वेन ग्राफ्ट्स RCA और LCX के लिए।
दवाएं: एस्पिरिन 75mg OD, एटोरवास्टेटिन 40mg HS, मेटोप्रोलोल 25mg BD।
फॉलो-अप: 2 सप्ताह में कार्डियोलॉजी समीक्षा।
आहार: कम नमक, कम वसा।
गतिविधि: धीरे-धीरे वृद्धि, 6 सप्ताह तक भारी उठाने से बचें।
लक्षण: सीने में दर्द, सांस की कमी, बुखार।
            """.strip(),
            "language": "hi",
            "discharge_date": "2024-02-08"
        },
        {
            "patient_id": patient_ids[3],
            "admitting_rmp_id": rmp_ids[0],
            "raw_content": """
Coronary Artery Bypass Grafting performed on 2024-03-10.
Procedure: 2-vessel CABG.
Medications: Aspirin, statin, beta-blocker.
Follow-up in 2 weeks.
Wound care required.
Cardiac rehab recommended.
            """.strip(),
            "language": "en",
            "discharge_date": "2024-03-17"
        }
    ]

    # Post-TKA orthopedic summaries (3)
    ortho_summaries = [
        {
            "patient_id": patient_ids[2],
            "admitting_rmp_id": rmp_ids[1],
            "raw_content": """
Patient underwent Total Knee Arthroplasty (TKA) on 2024-01-20.
Procedure: Right knee replacement with cemented prosthesis.
Post-op: Mobilization started on day 2, discharged on day 5.
Medications: Tramadol 50mg SOS, Cefuroxime 500mg BD for 5 days.
Physiotherapy: Knee exercises 3 times daily, walker for 2 weeks.
Follow-up: Orthopedic review in 6 weeks, X-ray before visit.
Activity: Avoid squatting, cross-legged sitting for 3 months.
Wound care: Keep dry, dressing change every 3 days.
Signs of infection: Redness, swelling, fever, discharge.
Emergency: Ortho department +91-9112345679.
            """.strip(),
            "language": "en",
            "discharge_date": "2024-01-25"
        },
        {
            "patient_id": patient_ids[4],
            "admitting_rmp_id": rmp_ids[1],
            "raw_content": """
टोटल नी आर्थ्रोप्लास्टी (TKA) 2024-02-15 को किया गया।
प्रक्रिया: बाएं घुटने प्रतिस्थापन।
दवाएं: ट्रामाडोल 50mg SOS, सेफुरोक्साइम 500mg BD।
फिजियोथेरेपी: दिन में 3 बार घुटने के व्यायाम।
फॉलो-अप: 6 सप्ताह में ऑर्थोपेडिक समीक्षा।
गतिविधि: 3 महीने तक बैठने से बचें।
घाव देखभाल: सूखा रखें।
            """.strip(),
            "language": "hi",
            "discharge_date": "2024-02-20"
        },
        {
            "patient_id": patient_ids[0],
            "admitting_rmp_id": rmp_ids[1],
            "raw_content": """
Total Knee Arthroplasty on 2024-03-05.
Left knee replacement.
Physiotherapy exercises daily.
Follow-up in 6 weeks.
Avoid strenuous activity.
            """.strip(),
            "language": "en",
            "discharge_date": "2024-03-10"
        }
    ]

    # General medical summaries (4)
    medical_summaries = [
        {
            "patient_id": patient_ids[1],
            "admitting_rmp_id": rmp_ids[2],
            "raw_content": """
Admitted for pneumonia management on 2024-01-10.
Diagnosis: Community-acquired pneumonia, right lower lobe.
Treatment: IV Ceftriaxone 2g BD for 7 days, Azithromycin 500mg OD for 5 days.
Discharged after clinical improvement.
Medications: Continue Azithromycin 500mg OD for 2 more days.
Follow-up: GP review in 1 week, repeat chest X-ray if symptoms persist.
Activity: Rest at home, avoid strenuous exertion.
Diet: High protein, plenty of fluids.
Warning signs: High fever, difficulty breathing, chest pain.
            """.strip(),
            "language": "en",
            "discharge_date": "2024-01-17"
        },
        {
            "patient_id": patient_ids[2],
            "admitting_rmp_id": rmp_ids[2],
            "raw_content": """
मधुमेह प्रबंधन के लिए 2024-02-05 को भर्ती।
निदान: टाइप 2 मधुमेह, खराब नियंत्रण।
उपचार: इंसुलिन समायोजन।
दवाएं: मेटफॉर्मिन 500mg BD, इंसुलिन ग्लारजीन 10 units HS।
फॉलो-अप: 1 सप्ताह में GP समीक्षा, रक्त शर्करा रिकॉर्ड लाएं।
आहार: कम कार्बोहाइड्रेट, उच्च फाइबर।
व्यायाम: दिन में 30 मिनट चलना।
चेतावनी: कम रक्त शर्करा के लक्षण।
            """.strip(),
            "language": "hi",
            "discharge_date": "2024-02-08"
        },
        {
            "patient_id": patient_ids[3],
            "admitting_rmp_id": rmp_ids[2],
            "raw_content": """
நீரிழிவு நோய் மேலாண்மை 2024-03-01 அன்று அனுமதிக்கப்பட்டார்.
நோயறிதழ்: டைப் 2 நீரிழிவு.
சிகிச்சை: இன்சுலின் சரிசெய்தல்.
மருந்துகள்: மெட்ஃபோர்மின் 500mg BD.
பின்தொடர்வு: 1 வாரத்தில் GP மதிப்பாய்வு.
உணவு: குறைந்த கார்போஹைட்ரேட்.
வார்னிங்: குறைந்த இரத்த சர்க்கரை அறிகுறிகள்.
            """.strip(),
            "language": "ta",
            "discharge_date": "2024-03-04"
        },
        {
            "patient_id": patient_ids[4],
            "admitting_rmp_id": rmp_ids[2],
            "raw_content": """
Admitted for hypertensive emergency on 2024-03-15.
Diagnosis: Uncontrolled hypertension.
Treatment: Amlodipine 5mg OD, Losartan 50mg OD.
Discharged after BP control.
Follow-up: GP review in 3 days, BP monitoring twice daily.
Diet: DASH diet, low sodium.
Activity: Moderate exercise, stress management.
Warning: Headache, visual changes, chest pain.
            """.strip(),
            "language": "en",
            "discharge_date": "2024-03-18"
        }
    ]

    summaries = cardiac_summaries + ortho_summaries + medical_summaries

    summary_ids = []
    for summary in summaries:
        summary["content_hash"] = get_content_hash(summary["raw_content"])
        result = supabase.table("discharge_summary").insert(summary).execute()
        summary_ids.append(result.data[0]["id"])
        print(f"Created discharge summary for patient {summary['patient_id']}")

    return summary_ids


def seed_consents(supabase: Client, patient_ids: List[uuid.UUID]) -> None:
    for patient_id in patient_ids:
        consent_data = {
            "patient_id": patient_id,
            "purpose": "data_processing",
            "granted_at": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(days=365)).isoformat()
        }
        supabase.table("consent").insert(consent_data).execute()
        print(f"Created consent for patient {patient_id}")


def main():
    print("Starting seed script...")
    
    supabase: Client = create_client(
        settings.supabase_url,
        settings.supabase_service_role_key
    )

    print("\nSeeding patients...")
    patient_ids = seed_patients(supabase)

    print("\nSeeding RMPs...")
    rmp_ids = seed_rmps(supabase)

    print("\nSeeding providers...")
    provider_ids = seed_providers(supabase)

    print("\nSeeding discharge summaries...")
    summary_ids = seed_discharge_summaries(supabase, patient_ids, rmp_ids)

    print("\nSeeding consents...")
    seed_consents(supabase, patient_ids)

    print("\nSeed script completed successfully!")
    print(f"Created {len(patient_ids)} patients")
    print(f"Created {len(rmp_ids)} RMPs")
    print(f"Created {len(provider_ids)} providers")
    print(f"Created {len(summary_ids)} discharge summaries")


if __name__ == "__main__":
    main()
