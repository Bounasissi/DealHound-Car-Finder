# DealHound Car Finder

This repository now includes a focused, testable core underwriting engine for DealHound:

- Canonical listing model
- Source and valuation provider abstractions
- VIN/title state and hard-reject rules
- 70% asking/reference gate
- All-in basis economics gate
- Conservative value and deal margin calculations
- Weighted 0–100 deal scoring with deal bands

## Run tests

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```
