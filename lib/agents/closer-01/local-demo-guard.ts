export function assertCloserLocalDemoEnvironment(): { projectId:string; authHost:string; firestoreHost:string; signingSecret:string; generator:"deterministic_fixture"|"mocked_responses" } {
  const deployed=(process.env.VERCEL==="1"&&Boolean(process.env.VERCEL_URL))||Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)||Boolean(process.env.K_SERVICE);
  if(deployed)throw new Error("local_demo_deployment_forbidden");
  if(process.env.NODE_ENV==="production"&&process.env.CLOSER_LOCAL_DEMO_LOCAL_BUILD!=="true")throw new Error("local_demo_production_forbidden");
  const generator=process.env.CLOSER_LOCAL_DEMO_GENERATOR;
  if(process.env.CLOSER_LOCAL_DEMO_ENABLED!=="true"||(generator!=="deterministic_fixture"&&generator!=="mocked_responses"))throw new Error("local_demo_disabled");
  const projectId=process.env.FIREBASE_PROJECT_ID??process.env.GCLOUD_PROJECT??"",authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST??"",firestoreHost=process.env.FIRESTORE_EMULATOR_HOST??"",signingSecret=process.env.CLOSER_SIMULATION_AUTHORITY_SIGNING_SECRET??"";
  const loopback=(value:string)=>/^(?:127\.0\.0\.1|localhost):\d+$/.test(value);
  if(!projectId.startsWith("demo-")||!loopback(authHost)||!loopback(firestoreHost)||Buffer.byteLength(signingSecret)<32)throw new Error("local_demo_configuration_unsafe");
  return{projectId,authHost,firestoreHost,signingSecret,generator};
}
