import test from "node:test";
import assert from "node:assert/strict";
import { contactSchema,statusSchema } from "../packages/core/src/validation.ts";
const valid={name:"Rutger",email:"person@example.test",goal:"strength",locale:"nl",requestId:"8016bb18-1087-49b7-a3e7-6a0f021accff"};
test("minimal request is enough; optional fields remain optional",()=>{const result=contactSchema.safeParse(valid);assert.ok(result.success);assert.equal(result.data.phone,"");});
test("reject malformed email, unexpected fields, invalid goals and oversized messages",()=>{for(const extra of [{email:"bad"},{activityId:"other"},{goal:"medical"},{message:"a".repeat(2001)},{name:"x"},{locale:"de"},{requestId:"bad"}])assert.equal(contactSchema.safeParse({...valid,...extra}).success,false);});
test("status changes require a known status and optimistic-lock version",()=>{assert.ok(statusSchema.safeParse({status:"closed",expectedVersion:1}).success);assert.equal(statusSchema.safeParse({status:"closed"}).success,false);assert.equal(statusSchema.safeParse({status:"paid",expectedVersion:1}).success,false);});
