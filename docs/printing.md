# Printing and local scheduling

[Project overview](../README.md) · [Privacy](privacy.md)

This alpha submits documents through the computer's installed printing system. It does not connect directly to every printer model, maintain a cloud print service or prove that a page physically emerged from the printer.

## First setup

1. Install and configure the printer in your operating system. Confirm that a normal OS test page works.
2. In Personal Press, refresh the printer list and explicitly select the intended device. Merely being the system default does not select it for unattended printing.
3. Choose **A4, Letter or A3**, and simplex, long-edge duplex or short-edge duplex. The printer/driver must support the selection.
4. Click the test-page action. This is a real, explicit one-page print request.
5. Check the physical page for legible text, complete margins and the intended paper/orientation. A successful application message only confirms queue acceptance.
6. Enable the daily publication schedule, then enable automatic printing and save. The application requires a successful test submission for the selected printer, paper and duplex combination.

Changing the printer, paper size or duplex mode requires another successful test submission before automatic printing can be enabled. Font and content changes still need a sensible page limit and visual review.

## Automatic and manual printing

| Behavior | Automatic daily print | Manual print |
| --- | --- | --- |
| Trigger | Published issue is due, and automatic printing is enabled | You explicitly choose to print an issue |
| Printer | Explicit saved device name; no silent fallback | System print dialog, with the app's selection supplied |
| Copies | One automatic copy | Review the system dialog before confirming |
| Page limit | User setting from 1 to 12 pages; default 12 | The automatic safety limit does not prevent an explicit manual print |
| Retry | No automatic repeat after an uncertain or submitted attempt | A new manual action opens the dialog again; check the queue first |

The PDF preflight checks page count before automatic submission. Too many pages stop the automatic job. Consider fewer articles for future editions, smaller but legible type, another supported paper size, excluding leisure, or an explicit manual print. Editing reading appearance uses the existing issue; it does not generate new articles.

Print mode uses **white paper and dark ink**, regardless of the on-screen paper palette. It removes decorative background fills and uses print-specific page breaks. Printer drivers can alter margins and pagination, so a successful PDF preflight is not a substitute for checking your device's output.

When the selected printer is missing or a known preflight fault is detected, printing stops and an error is shown. Device status reporting varies by platform and driver: appearing in the installed-printer list does not prove that a printer is online, supplied with paper or ready to print. Personal Press never silently redirects an automatic job to the system default printer.

The adapter recognizes CUPS/IPP stopped queues, queues not accepting jobs and exposed blocking errors. It also understands legacy Windows status flags when present. Recent Electron versions no longer expose the former `PrinterInfo.status` field, so some drivers offer no usable preflight availability signal. Unknown status is not an online guarantee. Low-supply warnings and a busy queue alone do not incorrectly block a new job.

## What the job states mean

| State | What is known | Automatic behavior |
| --- | --- | --- |
| `preflight_failed` | The app stopped before calling the OS print boundary | Nothing was submitted. Fix the cause; an explicit settings save can clear the preflight block. |
| `submitting` | The reservation was saved, and an OS submission may be in progress | Further automatic attempts for that issue are blocked. |
| `submitted` | The OS callback reported acceptance | No automatic repeat. Physical completion is still unknown. |
| `uncertain` | The result was lost, timed out, failed after entering the OS boundary, or the app restarted during submission | No automatic repeat. Inspect the OS queue and printer before any manual print. |

The app **persists `submitting` before the OS call**. If the application stops at that boundary, startup recovery changes the record to `uncertain`. It cannot safely infer that the job was never sent.

A prior manual submission also suppresses a later automatic submission of the same issue. A deliberate additional manual print remains possible through the system dialog. Toggling automatic printing or changing the device does not erase a submitted/uncertain issue's ledger.

Do not edit or remove print-history metadata to trigger a retry. The ledger exists because “no callback” and “no printed page” are different situations.

## Publication timing

The schedule uses the timezone saved in publication settings, independent of a later change to the computer's display timezone. It checks while the app is running and after a system resume; it is not a background OS service.

- Preparation may begin up to **20 minutes before** the target delivery.
- A **00:05** delivery can start preparation at **23:45 on the preceding day**.
- A nonexistent local time in a DST gap resolves to the first valid instant after the gap; a repeated local time uses its first occurrence.
- A late launch can prepare **today's** missing issue. It does not generate or print a backlog of old dates.
- A prepared issue is published when due. Network/model delays can make it late; the target time is not a delivery-time guarantee.
- Changing timezones does not reset an already-used daily slot. A stored guard can defer creation until the next eligible local day.

There is one official issue per calendar date. Manual generation and scheduled preparation share that identity. Once prepared, an issue's content cannot be replaced by changing sources or preferences. The sample never occupies a real date and is never printed automatically.

For generation failures, scheduled retries wait at least ten minutes and stop after three failed attempts for the date. This generation policy is separate from printing: an uncertain print is never automatically retried.

## Keeping the application available

The **computer must be awake and the app must be running** to collect news, generate, publish or submit a print job. The alpha does not wake the computer, install a login-start task or operate a cloud scheduler. A local model server must also be running if selected.

Where the OS tray is available, closing the reader window can leave the application running in the tray. Use **Quit** to stop it. If no tray is available, closing all windows ends the app. Verify the actual running state rather than assuming that closing a window always keeps scheduling active.

## Common problems

| Symptom | Check |
| --- | --- |
| The automatic-print switch will not enable | Enable daily publication, select a current OS printer and submit a test with the same printer/paper/duplex settings. |
| A printer disappeared | Reconnect/reinstall it, refresh the list and explicitly select/test it again. No replacement printer is chosen automatically. |
| An edition exceeds the automatic page limit | Use an appropriate layout/paper, exclude leisure, or choose a manual print. The automatic maximum remains 12. |
| The job says submitted but nothing arrived | Check the OS queue, driver, paper and device. Queue acceptance is not completion. |
| The job says uncertain after a restart | Inspect the queue and physical output before manually printing. The app intentionally blocks an automatic duplicate. |
| No edition was printed after the computer was off | Launch the app, inspect today's generation/review status and printer state. Historical dates are not caught up. |

Printer names, driver status codes and the exact system dialog vary. Hardware testing and signed desktop releases are still part of the alpha's release work; no universal printer compatibility claim is made.
