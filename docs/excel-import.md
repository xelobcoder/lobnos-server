# Excel import preview

`POST /api/v1/parse-excel` accepts a multipart form with `file` and `target`
fields. The upload is limited to 10 MiB and the first worksheet is limited to
20,001 rows (including its header) and 100 columns. Requests exceeding those
limits receive HTTP 413.

The preview parses the workbook once, returns its rows, and includes the
target-specific valid rows in `validation`.
