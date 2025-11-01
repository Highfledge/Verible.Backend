# Pulse Scoring System - Explained Simply

## What is Pulse Scoring?

Pulse Scoring is our trust and safety system that automatically evaluates sellers on online marketplaces (like Facebook Marketplace and Jiji) to help buyers make safer purchasing decisions. It works like a credit score, but for sellers - giving each seller a score from 0 to 100 based on how trustworthy they appear.

---

## How Does It Work?

### Step 1: Profile Extraction
When someone wants to check a seller, our system:
- Visits the seller's marketplace profile page
- Extracts all available information automatically
- Collects data like ratings, reviews, account age, listings, and more

### Step 2: Score Calculation
Our system then analyzes 9 different factors to calculate a trust score. Each factor is weighted (some matter more than others) and combined into a final score.

### Step 3: Recommendations
Based on the score, users get clear recommendations on whether it's safe to buy from that seller.

---

## The 9 Scoring Factors

Here's how sellers are evaluated (listed by importance):

### 1. Verification Status (20% - Most Important)
**What it checks:** Whether the seller has verified their identity
**How it scores:**
- ID verified = 100 points (highest trust)
- Phone verified = 80 points
- Email verified = 60 points
- Unverified = 0 points (high risk)

**Why it matters:** Verified sellers are less likely to be scammers because they've provided official identification.

---

### 2. Account Age (15%)
**What it checks:** How long the seller has been active on the platform
**How it scores:**
- 2+ years = 100 points
- 1+ year = 80 points
- 6+ months = 60 points
- 3+ months = 40 points
- 1+ month = 20 points
- Less than 1 month = 0 points

**Why it matters:** Longer-established accounts are generally more trustworthy. Scammers often create new accounts repeatedly.

---

### 3. Rating Score (15%)
**What it checks:** The seller's average customer rating
**How it scores:**
- 4.5+ stars = 100 points (excellent)
- 4.0+ stars = 80 points (very good)
- 3.5+ stars = 60 points (good)
- 3.0+ stars = 40 points (fair)
- 2.5+ stars = 20 points (poor)
- Below 2.5 = 0 points (very poor)

**Why it matters:** Customer ratings show what previous buyers experienced. Higher ratings mean happier customers.

---

### 4. Profile Completeness (10%)
**What it checks:** Whether the seller has filled out their profile completely
**How it scores:** Points for having:
- Name (20 points)
- Profile picture (20 points)
- Location (20 points)
- Bio/description (20 points)
- Active listings (20 points)

**Why it matters:** Complete profiles show the seller is serious and transparent. Scammers often leave profiles empty.

---

### 5. Review Count (10%)
**What it checks:** How many customer reviews the seller has received
**How it scores:**
- 100+ reviews = 100 points (very established)
- 50+ reviews = 80 points
- 20+ reviews = 60 points
- 10+ reviews = 40 points
- 5+ reviews = 20 points
- Less than 5 = 0 points

**Why it matters:** More reviews mean more transactions and more social proof. New sellers with no reviews are riskier.

---

### 6. Listing Quality (10%)
**What it checks:** The quality and completeness of the seller's listings
**How it scores:** Points for having:
- Descriptive titles (30 points)
- Valid pricing information (30 points)
- Multiple listings (3+) (20 points)
- Listing dates (20 points)

**Why it matters:** Professional sellers create detailed listings. Scammers often post vague or incomplete listings.

---

### 7. Urgency Score (10%)
**What it checks:** Whether listings use suspicious urgency language
**How it scores:** This is a RED FLAG indicator - it looks for words like:
- "URGENT"
- "Need money ASAP"
- "Cash only"
- "Quick sale"
- "First come first serve"

**Why it matters:** Scammers often use urgent language to pressure buyers and rush transactions. Normal sellers don't need to rush.

---

### 8. Activity Score (5%)
**What it checks:** How many listings the seller has posted
**How it scores:**
- 50+ listings = 100 points (very active)
- 20+ listings = 80 points
- 10+ listings = 60 points
- 5+ listings = 40 points
- 1+ listing = 20 points
- No listings = 0 points

**Why it matters:** Active sellers with many listings are usually legitimate businesses or frequent sellers.

---

### 9. Response Rate (5%)
**What it checks:** How often the seller responds to messages
**How it scores:**
- 90%+ response rate = 100 points
- 80%+ = 80 points
- 70%+ = 60 points
- 60%+ = 40 points
- 50%+ = 20 points
- Below 50% = 0 points

**Why it matters:** Responsive sellers are more reliable and professional. Slow or no responses can indicate problems.

---

## How the Final Score is Calculated

1. **Starting Point:** Every seller starts with a base score of 50 (neutral)

2. **Factor Scoring:** Each of the 9 factors is scored from 0-100 points

3. **Weighted Calculation:** Each factor's score is multiplied by its importance percentage:
   - Example: Account Age scores 80 points × 15% = 12 points added to final score
   - Example: Verification scores 100 points × 20% = 20 points added to final score

4. **Final Score:** All weighted scores are added to the base score of 50

5. **Score Range:** Final score is always between 0-100

---

## What Do the Scores Mean?

### 80-100: High Trust ⭐⭐⭐⭐⭐
- **Meaning:** Very trustworthy seller with excellent track record
- **Recommendation:** Safe to purchase
- **What to expect:** Verified account, good ratings, established history

### 60-79: Good Trust ⭐⭐⭐⭐
- **Meaning:** Good seller with minor concerns
- **Recommendation:** Consider for purchase
- **What to expect:** Generally reliable, some areas could be better

### 40-59: Medium Trust ⭐⭐⭐
- **Meaning:** Mixed indicators - proceed carefully
- **Recommendation:** Review carefully before purchase
- **What to expect:** Some red flags, may need additional verification

### 0-39: Low Trust ⭐⭐
- **Meaning:** High risk seller
- **Recommendation:** Avoid or request additional verification
- **What to expect:** Unverified, poor ratings, or suspicious patterns

---

## What Data is Collected and Stored?

When a seller profile is checked, we collect and save:

### Profile Information
- Name
- Profile picture
- Location
- Bio/description

### Marketplace Statistics
- Account age (how long they've been selling)
- Total number of listings
- Average customer rating
- Total number of reviews
- Response rate to messages
- Verification status
- Last seen online
- Number of followers (if available)
- Product categories they sell in

### Recent Listings
- Listing titles
- Prices
- Dates posted
- Categories
- Descriptions

### Trust Indicators
- Has profile picture? (Yes/No)
- Has location? (Yes/No)
- Has bio? (Yes/No)
- Account age number
- Review count
- Average rating
- Verification status
- Follower count
- Last active time

---

## Example Scenarios

### Example 1: Trusted Veteran Seller
**Profile:**
- Account: 18 months old
- Verification: ID verified
- Rating: 4.7 stars from 85 reviews
- Response rate: 92%
- Listings: 45 active listings
- Profile: Complete with photo, location, bio

**Result:** Score of **100/100** - Highly Trusted ⭐⭐⭐⭐⭐
**Recommendation:** Safe to purchase

---

### Example 2: New Legitimate Seller
**Profile:**
- Account: 2 months old
- Verification: Phone verified
- Rating: 4.2 stars from 8 reviews
- Response rate: 75%
- Listings: 6 active listings
- Profile: Name and location only (no photo)

**Result:** Score of **~70/100** - Good Trust ⭐⭐⭐⭐
**Recommendation:** Consider for purchase, but be cautious as they're new

---

### Example 3: Suspicious Seller
**Profile:**
- Account: 1 week old
- Verification: None
- Rating: 3.2 stars from 3 reviews
- Response rate: 55%
- Listings: 12 listings with urgent language ("URGENT", "cash only")

**Result:** Score of **~30/100** - Low Trust ⭐⭐
**Recommendation:** Avoid or request additional verification
**Risk Factors:** New account, unverified, uses urgent/scam language

---

## Benefits of Pulse Scoring

### For Buyers
✅ **Make safer purchases** - Know who you're dealing with before you buy
✅ **Avoid scams** - Red flags are automatically detected
✅ **Save time** - All information in one place
✅ **Clear guidance** - Simple recommendations, not confusing numbers

### For Sellers
✅ **Build trust** - Good sellers get recognized
✅ **Stand out** - High scores help attract buyers
✅ **Improvement guidance** - See what factors affect your score
✅ **Fair evaluation** - Objective system based on real data

### For the Platform
✅ **Reduce fraud** - Identify suspicious sellers automatically
✅ **Better user experience** - Helpful, easy-to-understand scores
✅ **Data-driven decisions** - Evidence-based trust evaluation
✅ **Continuous improvement** - System learns and adapts

---

## Important Notes

- **Scores update over time** - As sellers get more reviews or update their profiles, scores can change
- **Historical data is saved** - We keep all extracted information for reference
- **Multiple checks possible** - You can check a seller's score anytime
- **Privacy respected** - We only use publicly available marketplace data
- **Not a guarantee** - High scores don't guarantee perfect transactions, but they significantly reduce risk

---

## Questions?

If you have questions about how scores are calculated or what they mean, feel free to ask. The system is designed to be transparent and help everyone make better, safer decisions when buying online.

