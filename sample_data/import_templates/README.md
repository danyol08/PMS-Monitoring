# Excel Import Templates

This folder contains template files for importing data into the PMS system. Each template shows the expected column structure for different data types.

## How to Use

1. **Download the appropriate template** for the data you want to import
2. **Fill in your data** following the column structure
3. **Save as Excel (.xlsx) or CSV (.csv)** format
4. **Use the Import Excel button** in the respective page to upload your file

## Templates Available

### 1. Hardware Contracts (`hardware_contracts_template.xlsx`)

**Required Columns:**
- `end_user` - End user/company name
- `model` - Device model
- `serial` - Serial number

**Note:** `sq` (Service Quote number) is now **auto-generated** based on the last SQ in your database. You don't need to include this column in your Excel file.

**Optional Columns:**
- `next_pms_schedule` - Next PMS date (YYYY-MM-DD format)
- `branch` - Branch location
- `technical_specialist` - Assigned technician
- `date_of_contract` - Contract start date (YYYY-MM-DD format)
- `end_of_contract` - Contract end date (YYYY-MM-DD format)
- `status` - Contract status
- `po_number` - Purchase order number
- `service_report` - Service report notes
- `history` - Historical notes
- `frequency` - Maintenance frequency
- `reports` - Report references
- `documentation` - Documentation notes

### 2. Label Contracts (`label_contracts_template.xlsx`)

**Required Columns:**
- `end_user` - End user/company name
- `part_number` - Part number
- `serial` - Serial number

**Note:** `sq` (Service Quote number) is now **auto-generated** based on the last SQ in your database. You don't need to include this column in your Excel file.

**Optional Columns:**
- Same optional fields as Hardware Contracts

### 3. Repairs (`repairs_template.xlsx`)

**Required Columns:**
- `sq` - Service Quote number
- `company_name` - Company name
- `device_model` - Device model
- `serial_number` - Serial number
- `issue_description` - Description of the issue

**Optional Columns:**
- `priority` - Priority level (low, medium, high, urgent)
- `status` - Repair status (pending, in_progress, completed, cancelled)
- `assigned_technician` - Assigned technician
- `estimated_completion` - Estimated completion date (YYYY-MM-DD format)
- `actual_completion` - Actual completion date (YYYY-MM-DD format)
- `resolution_notes` - Resolution notes
- `parts_used` - Parts used in repair
- `labor_hours` - Labor hours (numeric)
- `total_cost` - Total cost (numeric)
- `customer_satisfaction` - Customer satisfaction rating (1-5)

### 4. Service History (`service_history_template.xlsx`)

**Required Columns:**
- `contract_id` - Contract ID reference
- `service_date` - Service date (YYYY-MM-DD format)
- `service_type` - Type of service (PMS, Repair, etc.)
- `description` - Service description
- `technician` - Technician name

**Optional Columns:**
- `contract_type` - Contract type (hardware, label)
- `status` - Service status (completed, pending, cancelled)
- `service_report` - Detailed service report
- `company` - Company name
- `location` - Service location
- `model` - Device model
- `serial` - Serial number
- `sales` - Sales representative
- `sr_number` - Service request number

## Important Notes

### Date Formats
- All dates must be in **YYYY-MM-DD** format (e.g., 2024-01-15)
- Invalid dates will be skipped during import

### File Requirements
- **Supported formats:** Excel (.xlsx, .xls) and CSV (.csv)
- **Maximum file size:** 10MB
- **First row must contain column headers**
- **Remove empty rows** at the beginning of the file

### Data Validation
- Required columns must be present and not empty
- The system will skip rows with missing required data
- Import results will show the number of successfully imported records and any errors

### Permissions
- Only **Admin** and **Technician** users can import data
- Regular users will not see the import buttons

## Tips for Successful Import

1. **Use the exact column names** shown in the templates
2. **Keep data consistent** - use the same format for similar fields
3. **Test with a small file first** to verify the format
4. **Check the import results** for any errors or skipped rows
5. **Backup your data** before performing large imports

## Troubleshooting

**Common Issues:**
- **"Missing required columns"** - Check that all required column names match exactly
- **"Invalid date format"** - Ensure dates are in YYYY-MM-DD format
- **"File too large"** - Split large files into smaller chunks (under 10MB each)
- **"No data imported"** - Check that the file has data rows below the header row

**Getting Help:**
If you encounter issues with importing, contact your system administrator or check the import error messages for specific guidance.

