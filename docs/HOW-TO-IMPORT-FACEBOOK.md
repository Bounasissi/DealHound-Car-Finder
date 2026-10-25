# Importing a Facebook Marketplace Listing

DealHound uses user-assisted ingestion. It does not crawl Facebook or require a Facebook login.

Copy the listing URL and visible text, then add screenshots from the phone Marketplace app. Include the VIN when the seller provides it. Screenshot observations are evidence notes; they are not independent title or mechanical verification.

If you have the vehicle's KBB private-party Good-condition value, enter it during import. DealHound records it as a user-entered valuation and immediately calculates the asking/reference ratio. CSV imports accept the same value in a `kbbGoodValue` column.

If a listing has no VIN, DealHound will show that as missing information and give the next action: request the 17-digit VIN from the seller.
