### Issue 1: Referral Code Visibility and Management

Currently, when we create an **organization** or a **clinician**, the system automatically generates a unique referral code. However, the referral code is not currently visible on the frontend because there is no page where users can view or manage these codes.

The frontend should provide a page where the facility can view the referral code assigned to each clinician or organization and share it with them.

The clinician or organization can then include this referral code on referral papers whenever they refer clinical cases to our facility. We can use the referral code to identify and track the clinician or organization that referred a particular case.

### Issue 2: Commission Assignment Configuration

In **Application Settings**, we need to add a configuration that determines who the commission should be assigned to when a clinician belonging to an organization is selected.

For example, when a clinician within an organization is selected, the facility should be able to configure whether the commission should be assigned to:

* **The organization**, or
* **The individual clinician**

This should be configurable at the facility level so that each facility can determine how referral commissions are handled according to its workflow.


Issue 3: Accounting Not Tracking Cash Collections and Refunds

Currently, the accounting module does not properly track certain financial transactions made through the frontend.

When a patient has an outstanding balance, the system correctly records and tracks the outstanding amount. However, when payment for that outstanding amount is subsequently made through the Cash Collection section on the frontend, the payment does not reflect correctly in the accounting module.

Similarly, when a refund is processed, the refund is not currently being reflected in the accounting records.

We need to rectify this so that:

Payments made through Cash Collection are automatically reflected in accounting.
Payments made toward outstanding patient balances update the appropriate accounting records.
Refunds are recorded correctly in accounting as financial transactions.
The patient's billing balance and the accounting records remain synchronized.


Issue 4: Access to Previous Sales and Filtering for Front-End Users

On the Billing → Sales → Branches page, users have reported that, apart from Administrators, Managers, and Accountants, other users such as Front Desk/Customer Service Representatives cannot access sales made on previous days.

For example, a client may return three days after their initial visit, and the Customer Service Representative may need to go back to the sales records from that particular day to confirm whether the client was present or whether a particular transaction was made. Currently, these users cannot access or filter those historical records.

We therefore need to add settings under Application Settings to control access for Front Desk/Customer Service Representatives:

Allow viewing of sales summaries — determines whether Front Desk/Customer Service Representatives can view sales summaries and historical sales records.
Allow filtering of sales records — determines whether they can use the date and other available filters to search through previous sales.

These should be configurable at the facility level, allowing each facility to decide what level of historical sales access Front Desk/Customer Service Representatives should have.



### Issue 5: Expense Creation, Approval, and Payment Flow

Currently, when a **Company Admin** creates an expense, they have to leave the expense creation process, go back to the **Expenses** page, select the expense, click **Bulk Actions**, and then approve it. This makes the workflow unnecessarily long.

We need to make the expense approval and payment flow more seamless.

#### 1. Admin Expense Approval Prompt

When a Company Admin creates an expense, the system should display a confirmation modal asking whether they want to approve the expense immediately.

For example:

> **Expense created successfully. Would you like to approve this expense now?**

If they choose **Yes**, the expense should be approved immediately without requiring them to navigate back to the Expenses page.

After approval, the system can then ask whether they want to proceed with payment:

> **Expense approved. Would you like to make payment now?**

If they choose **Yes**, they should be taken directly into the payment flow.

The goal is to make the entire process **seamless: Create Expense → Approve → Pay**, without unnecessary navigation.

#### 2. Allow Admins to Approve Their Own Expenses

Currently, when an Admin creates an expense, the system does not allow that Admin to approve their own expense.

We should review and modify this behavior. This should be configurable through **Application Settings**, allowing each facility/company to decide whether an Admin is permitted to approve an expense that they created themselves.

For example, the setting could be:

**Allow users to approve their own expenses**

* **Yes** — the user can approve an expense they created.
* **No** — the expense must be approved by another authorized user.

This gives facilities flexibility to enforce either a **self-approval workflow** for trusted administrators or a **separation-of-duties workflow** where the creator and approver must be different users.
### Issue 6: Staff Free-of-Charge (FOC) Transactions in Accounting

Currently, when the **Staff Free-of-Charge (FOC)** plan is used for a patient transaction, the transaction does not properly reflect on the accounting side.

We need to ensure that every FOC transaction is automatically recorded and visible in the accounting module so that the facility can clearly identify:

* The services/tests that were provided.
* The total value of the services provided.
* That the transaction was processed under the **Staff FOC** plan.
* The staff member associated with the FOC transaction.
* The amount that would have been collected if the transaction were not free of charge.

We also need to determine the appropriate accounting treatment for these transactions. In particular, we should decide whether Staff FOC transactions should be reflected as **bad debts**, **staff benefits/expenses**, **discounts**, or under a separate **FOC/Staff Benefit** category.

The important requirement is that the system should not make these transactions disappear from the financial records. They should still be recognized as **sales/services rendered**, while clearly showing that the amount was waived under the Staff FOC arrangement.

The accounting and reporting system should therefore be able to distinguish between:

**Normal Sale → Amount Collected**

**FOC Sale → Service Rendered → Amount Waived → GHS 0 Collected**

This will allow management and accountants to see the true value of services provided under the Staff FOC plan and monitor its financial impact.
### Issue 7: Simplified Billing Workflow for Facilities Without Billing Strategies

One of the major issues with the current billing system is that the workflow is unnecessarily complicated for facilities that do not use multiple billing strategies.

Currently, the user has to go through several steps:

**Select Billing Source → Select Billing Strategy → Select Tests/Services → Apply Pricing → Complete Billing**

This complexity was introduced because the system supports different billing sources and pricing structures, such as:

* NHIS
* Private Health Insurance
* Organizations
* Clinicians
* General/Cash

However, not every facility needs this level of complexity. Some facilities simply have a straightforward price for each service or test depending on the payment category.

For example:

| Test/Service | General/Cash |   NHIS | Private Insurance |
| ------------ | -----------: | -----: | ----------------: |
| Malaria      |       GHS 30 | GHS 30 |            GHS 50 |

In this type of facility, the user should not have to select a billing source and then navigate through different billing strategies just to bill a patient.

### Proposed Solution

If the facility has **no billing strategies configured** — for example, the billing strategy table has no active strategy for organizations, clinicians, insurance, etc. — the frontend should automatically use a **simple billing workflow**.

The user should be able to:

**Select Patient → Select Tests/Services → Select/Confirm Payment Category → Complete Billing**

The frontend should handle the complexity internally.

When the billing information is submitted to the backend, the frontend should format the transaction so that it fits the **existing billing structure and database model**. The backend should still receive the appropriate billing source, pricing information, and other required fields, even though the user did not have to manually navigate through those configurations.

### Expected Behavior

The system should therefore support two billing experiences:

**1. Simple Billing Mode**

Used when the facility has not configured billing strategies.

> Select patient → Select tests/services → Apply the appropriate price → Bill

**2. Advanced Billing Mode**

Used when the facility has configured billing strategies for organizations, clinicians, insurance providers, NHIS, etc.

> Select billing source → Select relevant billing strategy → Select tests/services → Apply strategy-specific pricing → Bill

The purpose is to make the software **simple and seamless for facilities that do not need complex billing configurations**, while preserving the existing advanced billing architecture for facilities that require it.

The complexity should be handled by the system rather than being unnecessarily exposed to the user.


### Issue 8: Formula-Based and Calculated Laboratory Parameters

A major limitation of the current system is that it does not adequately support **calculated laboratory parameters**.

Many laboratory investigations contain parameters that are not directly measured by an analyzer but are **calculated from other results** using established mathematical formulas.

For example, a laboratory panel may have:

* Parameters directly obtained from an analyzer.
* Parameters calculated from other reported parameters.
* Parameters calculated using a mathematical formula, coefficient, reference value, or patient demographic information.
* Parameters that require a linear or other mathematical function.

A good example is **LFT and other chemistry panels**, where some reported values may depend on calculations based on other measured parameters.

### Proposed Solution

PLS should introduce a **Formula/Calculation Engine** that allows a laboratory to define how a parameter should be calculated without requiring developers to hard-code every formula.

For example:

**Calculated Parameter: Parameter C**

```text
Parameter C = (Parameter A × Parameter B) / Parameter D
```

The system should automatically obtain the required values from the patient's current investigation and calculate Parameter C when the necessary inputs are available.

### Formula Configuration

Each calculated parameter should be able to have a formula definition containing information such as:

* Parameter/test being calculated
* Formula/expression
* Input parameters required by the formula
* Units
* Decimal precision
* Conditions/requirements
* Reference range, where applicable
* Formula version
* Effective date
* Active/inactive status

The system should support mathematical operations such as:

```text
+
-
*
/
()
```

and, where required, functions such as:

```text
sqrt()
log()
abs()
min()
max()
```

The engine should also support conditional calculations where necessary.

### Example Workflow

Suppose:

```text
Parameter A = 10
Parameter B = 5
Parameter D = 2
```

and:

```text
Parameter C = (A × B) / D
```

PLS should automatically calculate:

```text
Parameter C = 25
```

The calculated result should then appear in the patient's laboratory result in exactly the same way as other parameters, while internally being identified as a **calculated parameter**.

### Important Architectural Requirement

The formula engine should be **generic**.

We should not create code such as:

```text
if test === "LFT" ...
if test === "X" ...
if test === "Y" ...
```

Instead, formulas should be stored as **configuration/data**, and the calculation engine should interpret and execute them.

This will allow administrators or authorized laboratory users to configure new calculations without requiring a new software release every time a laboratory wants to introduce a formula.

### Validation and Safety

The calculation engine should also:

* Validate that all required input parameters are available.
* Prevent calculation when required inputs are missing.
* Handle zero and invalid values safely.
* Validate units where unit conversion is required.
* Prevent arbitrary code execution from user-entered formulas.
* Record the formula/version used to generate a result.
* Recalculate when an input result changes, where appropriate.
* Preserve an audit trail of calculated results.
* Clearly distinguish **measured results** from **calculated results**.

### Future Capability

The same engine should eventually support more advanced laboratory calculations, including:

* Linear equations/functions.
* Ratios and indices.
* Corrected values.
* Derived laboratory parameters.
* Age/sex-dependent calculations.
* Formulas requiring patient demographics.
* Formulas requiring multiple test results.
* Conditional/reference-range calculations.

The objective is to make PLS capable of supporting new laboratory calculations **through configuration rather than continuous custom development**.



### Issue 9: Enforce Quality Control Before Laboratory Result Entry

Currently, the Quality Control (QC) functionality exists in the application, but many facilities do not actively use it. This creates a risk where laboratory results can be entered and released without a documented QC check for the relevant test.

We need to introduce a **QC enforcement mechanism** at the test configuration level.

### Proposed Solution

When configuring a test, we should add a setting such as:

**Require Quality Control Before Result Entry**

* **Yes**
* **No**

When this setting is enabled for a particular test, the system should require a valid QC record for that test before allowing patient results to be entered.

### Daily QC Requirement

For tests where QC enforcement is enabled, the system should check whether QC has been performed and recorded for the **current working day**.

For example:

> **Malaria Test**
> QC Required: **Yes**
> Today's QC: **Not Recorded**

The system should prevent users from entering patient results for that test and display an appropriate message:

> **QC Required:** Quality control has not been recorded for this test today. Please perform and record QC before entering patient results.

Once the QC has been successfully recorded and accepted for that working day, result entry should become available.

### Expected Workflow

```text
Test Configuration
        ↓
QC Required = YES
        ↓
New Working Day
        ↓
QC Not Yet Recorded
        ↓
Patient Result Entry BLOCKED
        ↓
Perform QC
        ↓
Record/Accept QC
        ↓
QC Valid for Working Day
        ↓
Patient Result Entry ALLOWED
```

### Important Considerations

The QC requirement should be **test-specific**. Some tests may require daily QC while others may not.

The system should therefore not simply ask:

> "Does this facility use QC?"

Instead, it should determine:

> **"Does this particular test require QC before results can be entered?"**

The QC record should also be linked to the relevant:

* Facility
* Test
* Working date
* QC material/level, where applicable
* QC result
* User who performed the QC
* QC status/acceptance
* Date and time

### Exception Handling

There should also be a controlled mechanism for authorized users to handle exceptional situations, such as equipment failure, unavailable QC material, or urgent testing.

If an authorized user is allowed to bypass the QC restriction, the system should require a reason and record the action in the audit trail.

This prevents users from simply bypassing the QC requirement without accountability.

### Objective

The goal is to make QC **enforceable rather than optional** for tests where the facility requires it.

A facility should be able to configure:

> **Test A → QC required daily → results blocked until QC is accepted**

while another test can remain:

> **Test B → QC not required → normal result entry**

This will make QC an integral part of the laboratory workflow rather than a separate feature that users can easily ignore.


### Issue 10: Simplified and Structured Ultrasound Reporting

Currently, the ultrasound reporting system is primarily a **text-based form**. The sonographer enters the findings and measurements manually into the report and then saves the completed report.

The problem is that this requires the sonographer to manually type information and perform calculations that could be handled automatically by the system.

We should improve the existing workflow by introducing a **structured ultrasound reporting interface** that makes report creation faster and easier, while still using the existing reporting and backend infrastructure.

### Proposed Workflow

Instead of presenting the user with one large text form, the system should guide them through the relevant parts of the examination.

For example, for an obstetric ultrasound:

**Select Scan Type**

→ First Trimester
→ Second Trimester
→ Third Trimester

Once the user selects the scan type, PLS presents the relevant fields.

For example:

**Third Trimester**

* Presentation → Cephalic / Breech / Transverse / Other
* BPD → enter measurement
* HC → enter measurement
* AC → enter measurement
* FL → enter measurement
* FHR → enter value
* AFI → enter measurements or values
* Placenta → select location
* Fetal movements → select
* Other findings → enter/select

The user should not have to manually type these things into a large report.

### Automatic Calculations

As the sonographer enters measurements, PLS should automatically perform the appropriate calculations using the ultrasound formula engine.

For example:

```text
BPD
HC
AC
FL
 ↓
Calculation Engine
 ↓
EFW / GA / Other Derived Values
```

Similarly, if the user enters the four AFI quadrant measurements, PLS should calculate the total AFI automatically.

### Automatic Report Generation

After the structured information has been entered, PLS should generate the corresponding report text automatically.

For example, the system could convert the structured information into a conventional report format:

**Findings**

> Single live intrauterine fetus in cephalic presentation. Fetal cardiac activity is present. Biometric measurements correspond to the calculated gestational age. Amniotic fluid volume is within the expected range. Placenta is posterior.

The generated text should remain **editable** before the user finalizes the report.

### Existing Backend

We should **not create an entirely separate reporting system**.

The structured interface should ultimately generate the same type of report/data that the current backend already understands.

The flow should therefore be:

```text
Structured Ultrasound Interface
            ↓
Measurements + Findings
            ↓
Formula/Calculation Engine
            ↓
Report Generator
            ↓
Existing Report Structure/API
            ↓
Backend
```

This allows us to improve the user experience without unnecessarily rebuilding the existing reporting infrastructure.

### The Core Objective

The objective is to move from:

**"Type everything into a report"**

to:

**"Select, enter measurements, and let PLS construct the report."**

The sonographer should still have the ability to add free-text observations where necessary, because ultrasound examinations will not always fit perfectly into predefined fields.

The system should therefore combine:

**Structured fields + automatic calculations + generated report + optional free text**

rather than eliminating the existing text-report capability entirely.

The primary goal is **speed, simplicity, consistency, and reduced manual work for the sonographer.**


### Issue 11: Laboratory Result TAT Monitoring Overview

Add an additional overview/dashboard within **Laboratory Operations** to monitor laboratory tests whose results have not yet been entered within defined turnaround-time thresholds.

The overview should use **large, highly visible summary cards** so staff can immediately see the number of pending tests that have exceeded each TAT threshold.

#### Required Overview Cards

The dashboard should display large cards such as:

* **Exceeded 6 Hours** — number of tests pending for more than 6 hours
* **Exceeded 12 Hours** — number of tests pending for more than 12 hours
* **Exceeded 24 Hours** — number of tests pending for more than 24 hours
* **Exceeded 32 Hours** — number of tests pending for more than 32 hours
* **Exceeded 64 Hours** — number of tests pending for more than 64 hours

For example:

> **6 Hours**
> **6 Tests**

> **12 Hours**
> **12 Tests**

> **24 Hours**
> **4 Tests**

The numbers should update dynamically based on the current time and the time the relevant test/result was expected or became pending.

#### Card Interaction

Each card should be clickable. Selecting a card should open the corresponding list of affected tests, showing information such as:

* Patient
* Laboratory number
* Test
* Sample/collection time
* Time elapsed
* Current status
* Responsible section/user where applicable

This will allow laboratory management to move from a **high-level operational overview → specific delayed tests** immediately.

#### Purpose

The objective is to provide laboratory management with an immediate visual indication of **TAT breaches**, rather than requiring staff to search through individual results or reports.

The overview should answer, at a glance:

**“How many tests are currently overdue, and how severely overdue are they?”**

The feature should be integrated into the existing Laboratory Operations workflow and should not replace the existing result-entry functionality.
