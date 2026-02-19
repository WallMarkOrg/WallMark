import { NextRequest, NextResponse } from 'next/server'
import { ipfsImageUrl } from '@/lib/ipfs'

const KIE_API_KEY = process.env.KIE_API_KEY;

const POLL_INTERVAL_MS = 3000;  // poll every 3s
const POLL_TIMEOUT_MS = 120000; // give up after 2 minutes

export async function POST(req: NextRequest) {
  try {
    const { wallPhotoCid, artworkCid, wallCornersJson } = await req.json();

    if (!KIE_API_KEY) {
      console.error("Missing KIE_API_KEY in .env.local");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const wallPhotoUrl = ipfsImageUrl(wallPhotoCid);
    const artworkUrl = ipfsImageUrl(artworkCid);

    // -------------------------------------------------------
    // STEP 1: Create the generation task
    // -------------------------------------------------------
    const taskPayload = {
      model: 'nano-banana-pro',
      input: {
        prompt: `Realistically composite the artwork onto the wall in the background photo. 
                 Match the perspective, lighting, and shadows of the wall. 
                 The wall corners define exactly where the artwork should be placed. 
                 Wall corners: ${wallCornersJson}`,
        image_input: [wallPhotoUrl, artworkUrl],
        aspect_ratio: '16:9',
        resolution: '2K',
        output_format: 'png',
      }
    };

    console.log("Creating kie.ai task with model: nano-banana-pro");

    const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`,
      },
      body: JSON.stringify(taskPayload),
    });

    const createData = await createRes.json();
    console.log("kie.ai Create Task Response:", JSON.stringify(createData, null, 2));

    if (createData.code !== 200 || !createData.data?.taskId) {
      console.error("Failed to create kie.ai task:", createData);
      return NextResponse.json(
        { error: createData.msg || "Failed to create generation task" },
        { status: createRes.status }
      );
    }

    const taskId = createData.data.taskId;
    console.log("kie.ai Task created. Polling taskId:", taskId);

    // -------------------------------------------------------
    // STEP 2: Poll until success, fail, or timeout
    // -------------------------------------------------------
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const pollRes = await fetch(
        `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${KIE_API_KEY}`,
          },
        }
      );

      const pollData = await pollRes.json();
      const state = pollData.data?.state;
      console.log(`kie.ai Poll [${taskId}] state:`, state);

      if (state === 'success') {
        const resultJson = JSON.parse(pollData.data.resultJson || '{}');
        const previewUrl = resultJson.resultUrls?.[0];

        if (!previewUrl) {
          console.error("Task succeeded but no resultUrl found:", pollData.data.resultJson);
          return NextResponse.json({ error: "AI produced no image output" }, { status: 500 });
        }

        console.log("kie.ai Preview ready:", previewUrl);
        return NextResponse.json({ previewUrl });
      }

      if (state === 'fail') {
        console.error("kie.ai task failed:", pollData.data?.failCode, pollData.data?.failMsg);
        return NextResponse.json(
          { error: pollData.data?.failMsg || "Generation failed" },
          { status: 500 }
        );
      }

      // state === 'waiting' or anything else — keep polling
    }

    console.error("kie.ai task timed out after", POLL_TIMEOUT_MS / 1000, "seconds");
    return NextResponse.json({ error: "Generation timed out" }, { status: 504 });

  } catch (e: any) {
    console.error("AI Preview Route Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}