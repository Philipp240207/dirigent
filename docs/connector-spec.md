# Dirigent connector spec (deliverable B)

A **connector** plugs one partner into centrix. It is a short JSON config, not a software project. Dirigent reads it and knows when the partner is needed, what the partner may see, how to talk to them and what comes back into centrix.

The four blocks are reltix's four steps:

| reltix step | Block | Question it answers |
|---|---|---|
| 1. Detect the moment | `detect` | When is this partner needed? |
| 2. Hand over context | `handover` | What does the partner get from us, and what never? |
| 3. Hold the conversation | `conversation` (+ optional `resident_contact`) | How, in which language and with which goal do we talk to the partner (and to the resident)? |
| 4. Close the loop | `close_loop` | What do we get back, where is it stored, who is told? |

Plus: `partner_id`, `role`, `category`, `mode` (`deliver` = repairs and services, `sell` = products like internet), `cost_rule`.

Every connector is validated against `connectors/schema.json` before it can be activated.

## Fields

### Top level
| Field | Type | Meaning |
|---|---|---|
| `partner_id` | string, `a-z0-9_` | Unique ID, for example `plumber_krause` |
| `role` | `plumber`, `electrician`, `heating`, `locksmith`, `isp`, `owner` | Decides which property data the partner may see (`share_with` in the building data lists roles, never partner IDs) |
| `category` | string | Free label, for example `repairs`, `internet` |
| `mode` | `deliver` or `sell` | Repair and service partners versus partners who sell to residents |
| `cost_rule` | string | When an expensive channel (voice) is worth it |

### 1. `detect`
| Field | Meaning |
|---|---|
| `events` | Case types that trigger this partner: `water_leak`, `drain_blocked`, `heating_failure`, `power_outage`, `lockout`, `move_in`, `move_out`, `annual_invoice`, `water_leak_near_electrics` |
| `conditions` (optional) | A plain-language condition, for example `severity >= 2` or `photo assessment electrics = true`. The model evaluates the condition against the case and logs the result as a reasoning step, so the decision is visible to the property manager |

### 2. `handover`
| Field | Meaning |
|---|---|
| `required` | Fields the partner needs to do the job. Sharing is an **allowlist**: a field is shared only if it is listed here **and** the partner's role is allowed for it in the property data. Everything else is withheld |
| `never` | Fields that are never shared, even by mistake (for example rent arrears, the key safe code) |

The shared and withheld fields are computed by code, not by the model. The model only writes the briefing text and only sees the shared fields. The property manager sees both lists on the review card and clicks **Approve and send** before anything leaves centrix.

### 3. `conversation` and `resident_contact`
| Field | Meaning |
|---|---|
| `channel` | `browser` (partner page), `phone` (outbound call) or `message` |
| `agent` | ElevenLabs agent: `partner_call` or `resident_call` |
| `language` | `de`, `en` or `fr` |
| `goal` | What the conversation must achieve, for example "confirm the earliest slot, get a cost estimate" |

`resident_contact` (optional) has the same fields and is used when the partner flow also needs the resident, for example to confirm a tariff after a move-in.

### 4. `close_loop`
| Field | Meaning |
|---|---|
| `result_fields` | What the partner reports back, for example `slot`, `cost_eur`, `work_description` |
| `write_to_property` | Where the result is stored in centrix: `maintenance_log` or `unit_record` |
| `notify` | Who is told when the job is done: `tenant`, `affected_tenants`, `owner` |
| `approval_over_eur` (optional) | Costs above this need the owner's approval |

## Example 1: plumber (`mode: deliver`)
File: `connectors/plumber_krause.json`

- **Detect:** `water_leak`, `drain_blocked`, only if severity is 2 or more.
- **Handover:** address, unit, caretaker contact, damage photo and assessment, tenant availability, affected units. Never rent arrears or the key safe code.
- **Conversation:** partner page in the browser, agent `partner_call`, German. Goal: earliest slot that fits the affected tenants, cost estimate.
- **Close the loop:** slot, cost, work description go into the maintenance log. Tenant, affected neighbours and owner are told. Above 500 EUR the owner must approve.

## Example 2: electrician (generated live, `mode: deliver`)
File: `docs/examples/electrician_schmitz.json`

In the demo the property manager pastes the website text of Elektro Schmitz (`docs/elektro_schmitz_website.txt`). GPT drafts this connector, it is validated against the schema, the manager clicks **Activate**, and the electrician joins the running case.

- **Detect:** `water_leak_near_electrics`, `power_outage`, condition: the photo assessment says electrics are involved.
- **Handover:** the same fields as the plumber, without the list of affected units (the electrician only checks the lamp and wiring in 3.1).
- **Conversation:** partner page, `partner_call`, German. Goal: earliest slot to check the lamp and wiring, ideally together with the plumber.
- **Close the loop:** slot, cost, work description into the maintenance log, tenant and owner told.

## Example 3: internet provider (`mode: sell`)
File: `docs/examples/isp_rheinnet.json` (fictional provider)

The same four blocks work for partners who sell something:

- **Detect:** `move_in`.
- **Handover:** tenant name, move-in date, unit, phone, internet line ID. Never rent arrears.
- **Conversation:** a pre-filled order as a message to the provider. `resident_contact`: a phone call with `resident_call` to confirm tariff and activation date with the new tenant.
- **Close the loop:** contract signed and activation date go into the unit record, tenant and owner told.

## What the partner gets, what we get back

| | Partner gets (handover) | centrix gets back (close the loop) |
|---|---|---|
| Plumber | address, unit, caretaker contact, photo, assessment, availability, affected units | slot, cost, work description in the maintenance log |
| Electrician | address, unit, caretaker contact, photo, assessment, availability | slot, cost, work description in the maintenance log |
| Internet provider | name, move-in date, unit, phone, line ID | contract status and activation date in the unit record |

## Adding a new partner
1. Paste the partner's website text or write the JSON by hand.
2. Dirigent drafts the connector and validates it against `connectors/schema.json`.
3. The property manager checks it and clicks **Activate**.
4. From the next matching case on, the partner is part of the flow. No code changes.
