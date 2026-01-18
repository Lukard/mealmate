# Legal Compliance Review: Meal Automation Product

> **Review Date**: 2026-01-16
> **Reviewer**: Legal Compliance Agent
> **Jurisdiction**: Spain / European Union
> **Status**: INITIAL REVIEW

---

## Executive Summary

This document assesses legal and regulatory compliance requirements for a meal automation product operating in Spain/EU. The product involves web scraping of supermarket websites, handling of personal data, and potential recipe content aggregation, each presenting distinct legal considerations.

---

## 1. GDPR Compliance (Regulation 2016/679)

### 1.1 Legal Basis for Processing

| Data Processing Activity | Legal Basis | GDPR Article |
|-------------------------|-------------|--------------|
| Account creation | Consent | Art. 6(1)(a) |
| Meal preference storage | Contract performance | Art. 6(1)(b) |
| Shopping list generation | Contract performance | Art. 6(1)(b) |
| Analytics/improvements | Legitimate interest | Art. 6(1)(f) |
| Marketing communications | Explicit consent | Art. 6(1)(a) |
| Health data (allergies) | Explicit consent | Art. 9(2)(a) |

### 1.2 Special Category Data (Article 9)

**WARNING**: Dietary restrictions and allergies may constitute health data under GDPR.

```
REQUIREMENTS FOR HEALTH DATA:
1. Explicit, informed consent required
2. Separate consent from terms of service
3. Consent must be freely given, specific, informed
4. Easy withdrawal mechanism required
5. Enhanced security measures mandatory
6. Data Protection Impact Assessment (DPIA) required
```

### 1.3 Data Subject Rights Implementation

| Right | GDPR Article | Implementation Requirement |
|-------|--------------|---------------------------|
| Right to Access | Art. 15 | Export all user data in 30 days |
| Right to Rectification | Art. 16 | Allow data editing in-app |
| Right to Erasure | Art. 17 | Delete all data on request |
| Right to Portability | Art. 20 | Export in machine-readable format |
| Right to Object | Art. 21 | Stop processing on request |
| Right to Restrict | Art. 18 | Pause processing on request |
| Right re: Automated Decisions | Art. 22 | Human review for significant decisions |

### 1.4 Required Documentation

- [ ] **Privacy Policy** (Art. 13, 14)
  - Identity of controller
  - DPO contact details
  - Purposes and legal basis
  - Data retention periods
  - Third-party sharing
  - International transfers
  - User rights explanation

- [ ] **Cookie Policy**
  - Types of cookies used
  - Purpose of each cookie
  - Consent mechanism (cookie banner)

- [ ] **Data Processing Agreement** (Art. 28)
  - Required with any processors (hosting, analytics)

- [ ] **Records of Processing Activities** (Art. 30)
  - Internal documentation of all processing

- [ ] **Data Protection Impact Assessment** (Art. 35)
  - Required for health data processing

### 1.5 Data Protection Officer (DPO)

Under GDPR, a DPO may be required if:
- Processing health data at large scale
- Regular and systematic monitoring of data subjects

**Recommendation**: Consider appointing a DPO or external DPO service.

### 1.6 Data Breach Notification

```
BREACH NOTIFICATION REQUIREMENTS:
- Notify AEPD within 72 hours of becoming aware
- Notify affected users "without undue delay" if high risk
- Document all breaches (even unreported ones)
- Prepare breach notification templates in advance
```

---

## 2. Spanish Data Protection Law (LOPDGDD)

### 2.1 Additional Spanish Requirements

| Requirement | LOPDGDD Article | Description |
|-------------|-----------------|-------------|
| Digital Rights | Title X | Specific digital rights for citizens |
| Deceased Persons | Art. 3 | Family can exercise rights for deceased |
| Minors | Art. 7 | Parental consent under 14 years |
| Blocking of Data | Art. 32 | Data blocking instead of immediate deletion |

### 2.2 Age Verification

Under Spanish law (LOPDGDD Art. 7):
- Minors under 14 need parental consent
- Implement age verification mechanism
- Keep records of consent for minors

### 2.3 AEPD Registration

While GDPR eliminated mandatory registration, Spain requires:
- Records of processing activities
- Response to AEPD inquiries
- Cooperation with supervisory authority

---

## 3. Web Scraping Legal Analysis

### 3.1 Terms of Service Compliance

**CRITICAL**: Most supermarket websites prohibit scraping in their terms of service.

| Supermarket | ToS Position on Scraping | Risk Level |
|-------------|-------------------------|------------|
| Mercadona | Likely prohibited | HIGH |
| DIA | Likely prohibited | HIGH |
| Carrefour | Likely prohibited | HIGH |
| Alcampo | Likely prohibited | HIGH |

**Legal Considerations**:

1. **Contract Law**: Accessing a website may create an implied contract
2. **Computer Fraud**: Unauthorized access may violate criminal laws
3. **Unfair Competition**: Commercial use of scraped data
4. **Database Rights**: EU Database Directive protection

### 3.2 Relevant Spanish Laws

```
LEY ORGÁNICA 1/2015 (Código Penal) - Art. 197 bis:
- Unauthorized access to computer systems
- Penalties: Prison 6 months to 2 years

LEY 3/1991 (Competencia Desleal) - Art. 11:
- Acts of unfair exploitation
- Obtaining trade secrets

LEY 34/2002 (LSSI) - Art. 8:
- Interference with information services
```

### 3.3 EU Database Directive (96/9/EC)

Supermarket product databases may be protected:
- **Sui generis right**: Protects substantial investment in database
- **Duration**: 15 years from creation
- **Extraction prohibition**: Cannot extract substantial portions

### 3.4 Risk Mitigation Strategies

| Strategy | Risk Reduction | Feasibility |
|----------|---------------|-------------|
| Official API partnerships | ELIMINATES | Preferred - Contact supermarkets |
| Open price comparison APIs | HIGH | Investigate existing services |
| User-directed browsing only | MEDIUM | User provides own data |
| Manual data entry | HIGH | Poor UX |
| robots.txt compliance | LOW | Not legally binding |
| Rate limiting | LOW | Doesn't address legal issues |

### 3.5 Recommended Approach

```
PRIORITY ORDER:
1. PARTNERSHIP: Negotiate API access with supermarkets
   - Benefits: Legal, reliable, faster
   - Approach: B2B partnership proposal

2. AFFILIATE PROGRAMS: Use affiliate APIs if available
   - Often includes product/price data
   - Revenue sharing model

3. USER-AGENT MODEL: Browser extension where USER browses
   - User-directed activity
   - No server-side scraping
   - Reduced legal exposure

4. AGGREGATOR APIs: Use existing price comparison services
   - Idealo, Tiendeo, Soysuper have APIs
   - Shift legal burden to them
```

---

## 4. Copyright and Intellectual Property

### 4.1 Recipe Copyright

| Element | Copyright Status | Recommendation |
|---------|-----------------|----------------|
| Ingredient lists | NOT protected | Can use freely |
| Basic instructions | Generally NOT protected | Minimal risk |
| Creative descriptions | PROTECTED | Rewrite required |
| Photos | PROTECTED | License or create own |
| Recipe names | Generally NOT protected | Check trademarks |
| Cookbooks/compilations | PROTECTED | Cannot copy structure |

### 4.2 Product Information

```
SUPERMARKET DATA COPYRIGHT:
- Product names: Not copyrightable (factual)
- Prices: Not copyrightable (factual)
- Product descriptions: May be protected
- Product images: Protected by copyright
- Database compilation: Protected (sui generis right)
```

### 4.3 Trademark Considerations

- Do not use supermarket logos without permission
- Cannot imply endorsement or partnership
- Fair use for comparative/informational purposes
- Disclaimer: "Not affiliated with [supermarket]"

---

## 5. Consumer Protection

### 5.1 Spanish Consumer Law

Under **Real Decreto Legislativo 1/2007**:

| Requirement | Article | Implementation |
|-------------|---------|----------------|
| Clear pricing | Art. 60 | Show all costs upfront |
| Pre-contractual info | Art. 97 | Inform before purchase |
| Withdrawal right | Art. 102 | 14-day withdrawal for services |
| Confirmation | Art. 98 | Confirm orders in writing |

### 5.2 Required Information to Users

Before providing service:
- [ ] Business identity and contact details
- [ ] Total price including taxes
- [ ] Payment methods
- [ ] Delivery timeframes
- [ ] Withdrawal rights
- [ ] Complaint handling procedures
- [ ] Contract duration and termination

### 5.3 Automated Decision-Making

If the app automatically selects products or stores:
- Inform users of automation
- Explain the logic involved
- Allow human override
- Don't discriminate unfairly

---

## 6. E-Commerce Compliance (LSSI)

### 6.1 Legal Notice Requirements

Under **Ley 34/2002** (LSSI-CE), website must display:

```
REQUIRED INFORMATION:
- Company name and legal form
- NIF/CIF number
- Registered address
- Email contact
- Trade registry details (if applicable)
- VAT number (if applicable)
- Professional body (if applicable)
- Regulatory authorization (if applicable)
```

### 6.2 Commercial Communications

- Clear identification as advertising
- Opt-in consent for marketing emails
- Unsubscribe in every message
- No misleading subject lines

---

## 7. Ethical Considerations

### 7.1 Respectful Scraping (If Pursued)

```
ETHICAL GUIDELINES:
1. Respect robots.txt (even if not legally binding)
2. Rate limit requests (max 1 req/second)
3. Identify your bot with contact info
4. Avoid peak hours
5. Cache data to reduce requests
6. Honor Crawl-delay directives
7. Don't bypass authentication
```

### 7.2 Price Manipulation Concerns

| Concern | Risk | Mitigation |
|---------|------|------------|
| Displaying outdated prices | Legal liability | Real-time refresh, timestamps |
| Price discrimination | Unfair to users | Show all users same prices |
| Affiliate bias | Loss of trust | Disclose affiliate relationships |

### 7.3 Affiliate Disclosure Requirements

Under EU consumer law and FTC-style guidelines:
- Clearly disclose affiliate relationships
- "We may earn commission from purchases"
- Disclosure near product recommendations
- Don't let commission influence recommendations unfairly

### 7.4 User Privacy in Meal Tracking

```
ETHICAL DATA HANDLING:
- Minimize data collection
- Delete data when no longer needed
- Never sell user data
- Anonymous analytics only
- No profiling for advertising
- No sharing with third parties for marketing
```

---

## 8. Compliance Checklist

### 8.1 Pre-Launch Requirements

#### GDPR/LOPDGDD
- [ ] Privacy Policy (Spanish + English)
- [ ] Cookie Policy and banner
- [ ] Terms of Service
- [ ] Data Subject Rights mechanism
- [ ] DPIA for health data
- [ ] Data Processing Agreements
- [ ] Records of Processing Activities
- [ ] Consent management system
- [ ] Age verification mechanism
- [ ] Breach notification procedure

#### E-Commerce (LSSI)
- [ ] Legal notice/imprint
- [ ] Commercial terms
- [ ] Order confirmation system
- [ ] Complaint handling procedure

#### Intellectual Property
- [ ] Original recipe content
- [ ] Licensed or original images
- [ ] Trademark disclaimers
- [ ] No unauthorized logo use

#### Web Scraping
- [ ] Legal review of approach
- [ ] Partnership negotiations initiated
- [ ] Alternative data sources evaluated
- [ ] robots.txt compliance documented

### 8.2 Ongoing Compliance

- [ ] Regular privacy policy updates
- [ ] Annual DPIA review
- [ ] User rights request handling
- [ ] Consent records maintenance
- [ ] Third-party contract reviews

---

## 9. Recommended Legal Actions

### 9.1 Immediate Actions

1. **Engage Spanish Data Protection Lawyer**
   - Review architecture for GDPR compliance
   - Draft privacy documentation
   - Advise on web scraping legality

2. **Contact Supermarkets**
   - Propose API partnership
   - Request affiliate program access
   - Clarify terms of service

3. **DPIA Completion**
   - Required for health data processing
   - Document before processing begins

### 9.2 Documentation to Prepare

| Document | Priority | Responsible |
|----------|----------|-------------|
| Privacy Policy | CRITICAL | Legal counsel |
| Terms of Service | CRITICAL | Legal counsel |
| Cookie Policy | HIGH | Legal/Dev team |
| DPIA | HIGH | DPO/Legal |
| Affiliate Disclosure | HIGH | Marketing/Legal |
| Legal Notice | MEDIUM | Legal counsel |

---

## 10. Risk Summary

### Compliance Risk Matrix

| Area | Risk Level | Main Concern |
|------|-----------|--------------|
| GDPR | MEDIUM | Health data processing |
| Web Scraping | HIGH | ToS violations, database rights |
| Copyright | LOW | Recipe content if original |
| Consumer Protection | LOW | Standard e-commerce compliance |
| E-Commerce | LOW | Documentation requirements |

### Overall Legal Risk: **MEDIUM-HIGH**

**Primary risk factors**:
1. Web scraping legality is uncertain
2. Health data processing requires explicit consent
3. Supermarket ToS likely prohibit scraping
4. Database rights may protect product databases

**Recommended path**: Pursue official partnerships before launch to eliminate scraping-related legal risk.

---

*This document is for informational purposes only and does not constitute legal advice. Consult with qualified Spanish/EU legal counsel before proceeding.*
