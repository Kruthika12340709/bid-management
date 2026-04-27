"""
Seeds bid_risks for every bid that has none.
Number and severity of risks reflects the bid's flag_high_risk counter.
"""
import asyncio, sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text
from database import engine

# Template risk pool — keyed by (category, severity)
HIGH_RISKS = [
    ("Technical",   "High", "High", "High",
     "Core ML model accuracy falls below 85% AUC threshold on production data",
     "Implement fallback rule-based engine; weekly model drift monitoring; retrain trigger at 82% AUC",
     "ML Lead"),
    ("Regulatory",  "High", "High", "High",
     "Data residency requirements not confirmed — cross-border data transfer may violate GDPR Article 44",
     "Engage DPO for SCCs; confirm data residency before go-live; implement data localisation controls",
     "Compliance Lead"),
    ("Commercial",  "High", "High", "High",
     "Client scope creep risk — original RFP scope under-specified; 30%+ effort overrun likely",
     "Enforce change control from Day 1; fixed-price deliverables with formal sign-off gates",
     "Delivery Lead"),
    ("Resource",    "High", "High", "High",
     "Key solution architect double-booked across two concurrent programmes",
     "Identify backup architect; reduce parallel allocation to max 60%; flag to Resource Director",
     "People Ops"),
    ("Technical",   "High", "High", "High",
     "Third-party API dependency (client ERP) has no SLA — integration reliability unconfirmed",
     "Negotiate SLA with client IT; build retry/circuit-breaker layer; define fallback offline mode",
     "Backend Lead"),
]

MEDIUM_RISKS = [
    ("Technical",    "Medium", "Medium", "Medium",
     "Test environment parity with production not guaranteed — UAT failures may occur late",
     "Establish prod-like staging environment from sprint 3; define parity checklist",
     "Platform Eng"),
    ("Commercial",   "Medium", "High",   "Medium",
     "FX exposure on EUR-denominated contract — GBP/EUR rate movement could compress margin",
     "Hedge FX at contract signature; include FX adjustment clause in T&Cs",
     "Finance"),
    ("Resource",     "Medium", "Medium", "Medium",
     "Junior team members on critical path tasks — delivery quality risk during peak weeks",
     "Senior pair-programming for first two sprints; weekly code review gate",
     "Delivery Lead"),
    ("Regulatory",   "Low",    "High",   "Medium",
     "NHS DSPT submission deadline may conflict with project go-live timeline",
     "Submit DSPT 8 weeks before go-live; assign compliance owner; track via RAID log",
     "Compliance Lead"),
]

LOW_RISKS = [
    ("Technical",  "Low", "Low", "Low",
     "Minor versioning conflicts in CI/CD pipeline between Node.js and Python services",
     "Pin dependency versions; add dependency audit to weekly CI checks",
     "DevOps"),
    ("Commercial", "Low", "Low", "Low",
     "Client procurement process slower than expected — invoice payment terms may slip",
     "Agree milestone-based billing; include contractual late payment clause",
     "Finance"),
]


def build_risks(flag_high_risk: int):
    """Return a list of risk dicts proportional to flag_high_risk."""
    risks = []
    n_high = min(flag_high_risk, len(HIGH_RISKS))
    for i in range(n_high):
        cat, prob, imp, sev, desc, mit, owner = HIGH_RISKS[i]
        risks.append(dict(ref=f"R-{len(risks)+1:02d}", cat=cat, prob=prob, imp=imp, sev=sev,
                          desc=desc, mit=mit, owner=owner))
    # Always add 2 medium + 2 low for realism
    for i in range(min(2, len(MEDIUM_RISKS))):
        cat, prob, imp, sev, desc, mit, owner = MEDIUM_RISKS[i]
        risks.append(dict(ref=f"R-{len(risks)+1:02d}", cat=cat, prob=prob, imp=imp, sev=sev,
                          desc=desc, mit=mit, owner=owner))
    for i in range(min(2, len(LOW_RISKS))):
        cat, prob, imp, sev, desc, mit, owner = LOW_RISKS[i]
        risks.append(dict(ref=f"R-{len(risks)+1:02d}", cat=cat, prob=prob, imp=imp, sev=sev,
                          desc=desc, mit=mit, owner=owner))
    return risks


async def main():
    async with engine.begin() as conn:
        bids = (await conn.execute(text(
            "SELECT bid_id, bid_reference, flag_high_risk FROM bids ORDER BY bid_reference"
        ))).all()
        print(f"Found {len(bids)} bids")

        seeded = 0
        for bid_id, bid_ref, flag_high_risk in bids:
            existing = (await conn.execute(text(
                "SELECT COUNT(*) FROM bid_risks WHERE bid_id = :bid_id"
            ), {"bid_id": bid_id})).scalar()

            if existing and existing > 0:
                print(f"  {bid_ref}: already has {existing} risks — skipping")
                continue

            risks = build_risks(flag_high_risk or 0)
            print(f"  {bid_ref} (flag_high_risk={flag_high_risk}): seeding {len(risks)} risks…")

            for r in risks:
                await conn.execute(text("""
                    INSERT INTO bid_risks
                        (bid_id, risk_ref, description, category,
                         probability, impact, severity, mitigation, owner, acknowledged)
                    VALUES
                        (:bid_id, :ref, :desc, :cat,
                         :prob, :imp, :sev, :mit, :owner, false)
                """), {
                    "bid_id": bid_id,
                    "ref":    r["ref"],
                    "desc":   r["desc"],
                    "cat":    r["cat"],
                    "prob":   r["prob"],
                    "imp":    r["imp"],
                    "sev":    r["sev"],
                    "mit":    r["mit"],
                    "owner":  r["owner"],
                })
            seeded += 1

        total = (await conn.execute(text("SELECT COUNT(*) FROM bid_risks"))).scalar()
        print(f"\nDone — seeded {seeded} bids. Total bid_risks rows: {total}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
