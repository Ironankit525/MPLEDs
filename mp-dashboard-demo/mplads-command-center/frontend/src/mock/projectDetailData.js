/**
 * Comprehensive Mock Project Details Database (MP-Facing Portal).
 * Structured cleanly to reflect authorized MP constituency telemetry.
 */

export const MOCK_PROJECT_DETAILS = {
  // 1. Healthcare Infrastructure (Pune MP Constituency - MP001)
  "PRJ001": {
    id: "MPLADS-PUN-2026-001",
    altId: "PRJ001",
    mpId: "MP001",
    constituencyId: "Pune",
    financialYear: "2026-27",
    title: "Community Health Centre Upgradation",
    name: "Community Health Centre Upgradation",
    sector: "Healthcare Infrastructure",
    category: "Healthcare Infrastructure",
    description: "Modernization of rural 30-bed primary healthcare facility with new emergency diagnostics wing, maternity ward, solar backup, and computerized pharmacy dispatch unit.",
    location: {
      village: "Haveli",
      area: "Haveli Block HQ",
      district: "Pune",
      constituency: "Pune",
      state: "Maharashtra",
      latitude: 18.5204,
      longitude: 73.8567,
      mapsUrl: "https://www.google.com/maps?q=18.5204,73.8567"
    },
    status: "ONGOING",
    beneficiaries: 4200,
    dates: {
      proposalDate: "2025-11-12",
      sanctionDate: "2026-01-08",
      workOrderDate: "2026-02-05",
      startDate: "2026-02-15",
      expectedCompletionDate: "2026-09-18",
      actualCompletionDate: null,
      lastUpdated: "Updated 30 Aug 2026, 10:24 AM"
    },
    progress: {
      physical: 53,
      financial: 68.0,
      currentStage: "Structural Work (Floor 2 Slab & Column Framing)",
      lastUpdated: "Updated 30 Aug 2026, 10:24 AM"
    },
    financial: {
      estimatedCost: 3140000,
      sanctionedAmount: 3000000,
      releasedAmount: 2400000,
      utilizedAmount: 2040000,
      payments: [
        {
          id: "PAY-2026-001",
          date: "2026-02-20",
          description: "Initial Mobilization Advance & Site Layout Clearance",
          amount: 500000,
          milestoneId: "M25",
          status: "PAID",
          referenceNumber: "RBI-NEFT-20260220-8812"
        },
        {
          id: "PAY-2026-002",
          date: "2026-04-15",
          description: "Foundation & Plinth Concrete Running Bill (MB Vol-1, Pg 42)",
          amount: 740000,
          milestoneId: "M25",
          status: "PAID",
          referenceNumber: "RBI-NEFT-20260415-9943"
        },
        {
          id: "PAY-2026-003",
          date: "2026-07-02",
          description: "Structural RCC Framework & 1st Floor Slab Tranche",
          amount: 800000,
          milestoneId: "M50",
          status: "PAID",
          referenceNumber: "RBI-NEFT-20260702-1104"
        },
        {
          id: "PAY-2026-004",
          date: "2026-08-28",
          description: "Interior Wall Conduits & Electrical Infrastructure Bill",
          amount: 360000,
          milestoneId: "M75",
          status: "PROCESSING",
          referenceNumber: "PFMS-VOUCHER-2026-7782"
        }
      ]
    },
    expenditureReview: {
      categories: [
        { name: "Material Procurement (Cement, TMT Steel, Sand, Blocks)", amount: 1240000, percentage: 60.8, status: "VERIFIED" },
        { name: "Labor & Skilled Masonry Daily Wages", amount: 310000, percentage: 15.2, status: "VERIFIED" },
        { name: "Machinery & Concrete Transit Mixer Rental", amount: 240000, percentage: 11.8, status: "VERIFIED" },
        { name: "Site Utilities & Electrical Transformer Setup", amount: 170000, percentage: 8.3, status: "REQUIRES_REVIEW" },
        { name: "Supervision, Curing & Quality Testing", amount: 80000, percentage: 3.9, status: "VERIFIED" },
      ],
      aiCostReview: {
        status: "VARIANCE_DETECTED",
        verifiedCount: 4,
        reviewCount: 1,
        summary: "4 expenses verified against standard PWD Schedule of Rates. 1 electrical installation item is flagged for price variance (+18%).",
        varianceItem: {
          item: "Site Temporary Electrical Infrastructure & Transformer Laying",
          claimedAmount: 170000,
          benchmarkAmount: 144000,
          variancePercentage: 18,
          explanation: "Claimed rate for high-voltage panel cabling is 18% above the standard state benchmark rate.",
          recommendation: "Request itemized tax invoice and verification certificate from Assistant Engineer before final payment sign-off."
        }
      }
    },
    risk: {
      score: 67,
      level: "HIGH",
      factors: [
        {
          category: "Schedule Risk",
          score: 18,
          maxScore: 25,
          severity: "HIGH",
          reason: "Project is 12 days behind the planned baseline schedule due to heavy monsoon rains during roof casting."
        },
        {
          category: "Financial Risk",
          score: 15,
          maxScore: 20,
          severity: "HIGH",
          reason: "Financial utilization (68%) is 15 percentage points ahead of verified physical completion (53%)."
        },
        {
          category: "Execution Risk",
          score: 14,
          maxScore: 20,
          severity: "MEDIUM",
          reason: "Current structural milestone has experienced slower-than-planned labor mobilization on site."
        },
        {
          category: "Evidence Risk",
          score: 10,
          maxScore: 15,
          severity: "MEDIUM",
          reason: "Latest 50% milestone photos require additional engineering verification of beam curing."
        },
        {
          category: "Citizen Feedback Risk",
          score: 10,
          maxScore: 20,
          severity: "MEDIUM",
          reason: "2 citizen suggestions registered requesting ambulance bay expansion at entrance gate."
        }
      ]
    },
    contractor: {
      id: "CTR-2026-045",
      name: "BuildTech India Solutions Pvt. Ltd.",
      registrationNumber: "MH-REG-2019-8841",
      workOrderNumber: "WO-PUN-2026-045",
      performanceScore: 78,
      riskLevel: "Medium",
      status: "Ongoing",
      assignedProjects: 3,
      completedProjects: 18,
      delayedProjects: 1,
      onTimePercentage: 85,
      delaySignal: "Minor schedule drift observed during recent civil casting works",
      contactPerson: "Rajesh Sharma (Senior Project Engineer)",
      phone: "+91 98220 11998",
      email: "contact@buildtech.demo"
    },
    milestoneTracks: [
      {
        id: "M25",
        percentage: 25,
        label: "25% Milestone",
        stageName: "Foundation & Plinth Level",
        status: "COMPLETED",
        photoCount: 3,
        photosUploaded: true,
        summary: "Earthwork excavation, column footings, and plinth beam casting completed & cured."
      },
      {
        id: "M50",
        percentage: 50,
        label: "50% Milestone",
        stageName: "Structural Work & RCC Columns",
        status: "COMPLETED",
        photoCount: 3,
        photosUploaded: true,
        summary: "Ground floor structural columns, 1st floor ceiling slab, and vertical rebar framing underway."
      },
      {
        id: "M75",
        percentage: 75,
        label: "75% Milestone",
        stageName: "Brick Masonry & Electrical Conduits",
        status: "PENDING",
        photoCount: 0,
        photosUploaded: false,
        summary: "Interior brick walls, plumbing conduit lines, and solar backup wiring (Scheduled)."
      },
      {
        id: "M100",
        percentage: 100,
        label: "100% Milestone",
        stageName: "Finishing & Final Handover",
        status: "PENDING",
        photoCount: 0,
        photosUploaded: false,
        summary: "Medical equipment installation, diagnostic lab calibration, and statutory handover (Target: 18 Sep 2026)."
      }
    ],
    milestones: [
      {
        id: "MS-01",
        name: "Proposal & Feasibility Study",
        status: "COMPLETED",
        progress: 100,
        plannedStartDate: "2025-11-12",
        plannedEndDate: "2025-12-10",
        actualStartDate: "2025-11-12",
        actualEndDate: "2025-12-05"
      },
      {
        id: "MS-02",
        name: "Administrative & Technical Approval",
        status: "COMPLETED",
        progress: 100,
        plannedStartDate: "2026-01-08",
        plannedEndDate: "2026-01-25",
        actualStartDate: "2026-01-08",
        actualEndDate: "2026-01-20"
      },
      {
        id: "MS-03",
        name: "Tender Award & Work Order Issued",
        status: "COMPLETED",
        progress: 100,
        plannedStartDate: "2026-02-01",
        plannedEndDate: "2026-02-10",
        actualStartDate: "2026-02-01",
        actualEndDate: "2026-02-05"
      },
      {
        id: "MS-04",
        name: "Foundation & Plinth Construction",
        status: "COMPLETED",
        progress: 100,
        plannedStartDate: "2026-02-15",
        plannedEndDate: "2026-04-10",
        actualStartDate: "2026-02-16",
        actualEndDate: "2026-04-12"
      },
      {
        id: "MS-05",
        name: "Structural Work & RCC Column Slabs",
        status: "IN_PROGRESS",
        progress: 53,
        plannedStartDate: "2026-04-15",
        plannedEndDate: "2026-07-31",
        actualStartDate: "2026-04-18",
        actualEndDate: null
      },
      {
        id: "MS-06",
        name: "Interior Brickwork & Utilities",
        status: "PENDING",
        progress: 0,
        plannedStartDate: "2026-07-15",
        plannedEndDate: "2026-08-31",
        actualStartDate: null,
        actualEndDate: null
      },
      {
        id: "MS-07",
        name: "Final Inspection & Handover",
        status: "PENDING",
        progress: 0,
        plannedStartDate: "2026-09-01",
        plannedEndDate: "2026-09-18",
        actualStartDate: null,
        actualEndDate: null
      }
    ],
    timeline: [
      {
        id: "TL-01",
        stage: "Proposal Submitted",
        title: "Proposal Formally Submitted by Constituency Office",
        date: "12 Nov 2025",
        status: "COMPLETED",
        description: "Submitted following Haveli Village Panchayat infrastructure resolution."
      },
      {
        id: "TL-02",
        stage: "Sanctioned",
        title: "Administrative Sanction Issued by District Collectorate",
        date: "08 Jan 2026",
        status: "COMPLETED",
        description: "Official sanction order ₹30.00 Lakhs sanctioned under MPLADS head."
      },
      {
        id: "TL-03",
        stage: "Work Order Issued",
        title: "Work Order Awarded to BuildTech India Solutions",
        date: "05 Feb 2026",
        status: "COMPLETED",
        description: "Contract signed under standard e-tendering rules (WO-PUN-2026-045)."
      },
      {
        id: "TL-04",
        stage: "Work Started",
        title: "Site Demarcation & Foundation Excavation",
        date: "15 Feb 2026",
        status: "COMPLETED",
        description: "Civil foundation laying inaugurated with local block representatives."
      },
      {
        id: "TL-05",
        stage: "Current Stage",
        title: "Structural Work (53% Complete)",
        date: "24 Aug 2026",
        status: "CURRENT",
        description: "RCC columns and second-floor slab framing currently in progress."
      },
      {
        id: "TL-06",
        stage: "Inspection",
        title: "Field Quality Inspection Scheduled",
        date: "08 Sep 2026 (Scheduled)",
        status: "PENDING",
        description: "State Quality Monitor routine milestone audit."
      },
      {
        id: "TL-07",
        stage: "Completion",
        title: "Target Project Completion & Handover",
        date: "18 Sep 2026",
        status: "PENDING",
        description: "Public healthcare commissioning for rural citizens."
      }
    ],
    evidence: [
      // 50% Milestone Photos
      {
        id: "EV-050-1",
        milestoneId: "M50",
        milestoneName: "Structural Work & RCC Columns",
        photoNumber: "PHOTO #01",
        imageUrl: "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1200&q=80",
        thumbnailUrl: "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=400&q=80",
        uploadedAt: "24 Aug 2026, 04:32 PM",
        uploadedBy: "BuildTech India Solutions",
        contractorId: "CTR-2026-045",
        location: "Haveli PHC Campus, Sector 4 Block",
        gpsCoordinates: "18.5204° N, 73.8567° E",
        description: "Reinforced concrete columns and second-floor shuttering framework.",
        verificationStatus: "VERIFIED",
        aiAnalysis: {
          summary: "Site evidence demonstrates active structural beam casting and vertical column framing with safety scaffolding.",
          detectedObjects: ["Concrete columns", "Reinforcement steel bars", "Formwork shuttering", "Construction workers", "Safety helmets"],
          detectedActivities: ["Active structural framing", "Column curing", "Material stacking"],
          estimatedStage: "Structural Work",
          estimatedProgress: 51,
          contractorReported: 53,
          confidence: 89,
          consistency: {
            status: "CONSISTENT",
            difference: 2,
            explanation: "AI vision progress estimate (51%) is consistent with contractor reported milestone (53%)."
          },
          observations: [
            "RCC column grid matches approved architectural elevation drawings.",
            "Formwork for 2nd floor roof slab is ~50% aligned with reported milestone.",
            "Active labor crew present with visible PPE safety compliance."
          ]
        }
      },
      {
        id: "EV-050-2",
        milestoneId: "M50",
        milestoneName: "Structural Work & RCC Columns",
        photoNumber: "PHOTO #02",
        imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
        thumbnailUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=80",
        uploadedAt: "20 Aug 2026, 11:15 AM",
        uploadedBy: "BuildTech India Solutions",
        contractorId: "CTR-2026-045",
        location: "Haveli PHC North Elevation",
        gpsCoordinates: "18.5205° N, 73.8568° E",
        description: "First floor ceiling slab rebar mesh binding before concrete pouring.",
        verificationStatus: "VERIFIED",
        aiAnalysis: {
          summary: "Steel reinforcement mesh laid across first floor ceiling section with spacer blocks.",
          detectedObjects: ["TMT Rebar mesh", "Concrete spacers", "Shuttering plates"],
          detectedActivities: ["Rebar binding", "Level inspection"],
          estimatedStage: "Structural Slab Preparation",
          estimatedProgress: 49,
          contractorReported: 53,
          confidence: 91,
          consistency: {
            status: "CONSISTENT",
            difference: 4,
            explanation: "Rebar placement density is consistent with structural design requirements."
          },
          observations: [
            "Rebar spacing meets IS-456 standard requirements.",
            "Shuttering support props firmly secured."
          ]
        }
      },
      {
        id: "EV-050-3",
        milestoneId: "M50",
        milestoneName: "Structural Work & RCC Columns",
        photoNumber: "PHOTO #03",
        imageUrl: "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=1200&q=80",
        thumbnailUrl: "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=400&q=80",
        uploadedAt: "15 Aug 2026, 03:45 PM",
        uploadedBy: "BuildTech India Solutions",
        contractorId: "CTR-2026-045",
        location: "Haveli PHC Main Wing",
        gpsCoordinates: "18.5204° N, 73.8566° E",
        description: "Vertical column concrete curing and scaffolding setup.",
        verificationStatus: "AI_ANALYZED",
        aiAnalysis: {
          summary: "Water ponding and hessian cloth curing on vertical RCC column posts.",
          detectedObjects: ["Concrete columns", "Hessian curing wraps", "Scaffolding pipes"],
          detectedActivities: ["Concrete curing", "Site maintenance"],
          estimatedStage: "Structural Work",
          estimatedProgress: 48,
          contractorReported: 53,
          confidence: 88,
          consistency: {
            status: "CONSISTENT",
            difference: 5,
            explanation: "Curing process active; minor variance within normal curing intervals."
          },
          observations: [
            "Hessian wraps properly saturated for hydraulic strength development."
          ]
        }
      },

      // 25% Milestone Photos
      {
        id: "EV-025-1",
        milestoneId: "M25",
        milestoneName: "Foundation & Plinth Level",
        photoNumber: "PHOTO #01",
        imageUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
        thumbnailUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=400&q=80",
        uploadedAt: "12 May 2026, 10:30 AM",
        uploadedBy: "BuildTech India Solutions",
        contractorId: "CTR-2026-045",
        location: "Haveli PHC Foundation Pit",
        gpsCoordinates: "18.5202° N, 73.8565° E",
        description: "Completed foundation plinth beams and perimeter ground leveling.",
        verificationStatus: "VERIFIED",
        aiAnalysis: {
          summary: "Plinth beam concrete cured with stone masonry base up to plinth height.",
          detectedObjects: ["Plinth concrete beams", "Excavated perimeter", "Water curing tank", "Gravel aggregate"],
          detectedActivities: ["Foundation curing", "Ground compaction"],
          estimatedStage: "Foundation & Plinth",
          estimatedProgress: 25,
          contractorReported: 25,
          confidence: 95,
          consistency: {
            status: "CONSISTENT",
            difference: 0,
            explanation: "Plinth beam dimensions verified against structural blueprint."
          },
          observations: [
            "Plinth beam dimensions verified against structural blueprint.",
            "Water curing saturation levels adequate."
          ]
        }
      },
      {
        id: "EV-025-2",
        milestoneId: "M25",
        milestoneName: "Foundation & Plinth Level",
        photoNumber: "PHOTO #02",
        imageUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80",
        thumbnailUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=400&q=80",
        uploadedAt: "28 Mar 2026, 02:20 PM",
        uploadedBy: "BuildTech India Solutions",
        contractorId: "CTR-2026-045",
        location: "Haveli PHC Foundation Pit",
        gpsCoordinates: "18.5202° N, 73.8565° E",
        description: "Deep foundation excavation and footings steel cage placement.",
        verificationStatus: "VERIFIED",
        aiAnalysis: {
          summary: "Excavation pits with steel rebar cage assemblies set on PCC bed.",
          detectedObjects: ["Excavator backhoe", "Steel rebar cages", "Surveyor leveling staff"],
          detectedActivities: ["Excavation", "Trenching", "Rebar binding"],
          estimatedStage: "Excavation & Footing",
          estimatedProgress: 18,
          contractorReported: 20,
          confidence: 96,
          consistency: {
            status: "CONSISTENT",
            difference: 2,
            explanation: "Excavation depth adheres to geotechnical soil recommendations."
          },
          observations: [
            "Bed depth conforms to soil bearing capacity recommendations.",
            "No ground water seepage complications visible."
          ]
        }
      },
      {
        id: "EV-025-3",
        milestoneId: "M25",
        milestoneName: "Foundation & Plinth Level",
        photoNumber: "PHOTO #03",
        imageUrl: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80",
        thumbnailUrl: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=400&q=80",
        uploadedAt: "15 Mar 2026, 09:10 AM",
        uploadedBy: "BuildTech India Solutions",
        contractorId: "CTR-2026-045",
        location: "Haveli PHC Boundary",
        gpsCoordinates: "18.5201° N, 73.8564° E",
        description: "Site demarcation, land leveling, and boundary hoarding.",
        verificationStatus: "VERIFIED",
        aiAnalysis: {
          summary: "Initial site clearing and pegging of building corners.",
          detectedObjects: ["Theodolite survey equipment", "Boundary fencing", "Survey pegs"],
          detectedActivities: ["Site surveying", "Demarcation"],
          estimatedStage: "Site Demarcation",
          estimatedProgress: 10,
          contractorReported: 10,
          confidence: 98,
          consistency: {
            status: "CONSISTENT",
            difference: 0,
            explanation: "Coordinates match sanctioned cadastral survey plot."
          },
          observations: [
            "Cadastral boundaries verified against revenue survey map."
          ]
        }
      }
    ],
    beforeAfter: {
      title: "Milestone Progression Comparison",
      dateBefore: "12 May 2026 (25% Milestone)",
      labelBefore: "Foundation & Plinth Level",
      imageBefore: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1000&q=80",
      dateAfter: "24 Aug 2026 (50% Milestone)",
      labelAfter: "Structural RCC Framework",
      imageAfter: "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1000&q=80",
      aiVerdict: "AI verified visible construction progression between the 25% and 50% milestone stages. Ground foundation works successfully transitioned into elevated RCC structural columns and first floor slab formwork."
    },
    documents: [
      {
        id: "DOC-001",
        name: "Collectorate Administrative Sanction Order",
        type: "Sanction order",
        uploadedAt: "08 Jan 2026",
        status: "APPROVED",
        fileSize: "1.4 MB"
      },
      {
        id: "DOC-002",
        name: "Contractor Agreement & Work Order",
        type: "Work order",
        uploadedAt: "05 Feb 2026",
        status: "ACTIVE",
        fileSize: "2.1 MB"
      },
      {
        id: "DOC-003",
        name: "Public Works Technical Sanction Approval",
        type: "Project approval",
        uploadedAt: "18 Jan 2026",
        status: "APPROVED",
        fileSize: "3.8 MB"
      },
      {
        id: "DOC-004",
        name: "Measurement Book (MB Vol-1) & 3rd Running Bill",
        type: "Payment/milestone documents",
        uploadedAt: "02 Jul 2026",
        status: "VERIFIED",
        fileSize: "5.6 MB"
      }
    ],
    inspections: [
      {
        id: "INSP-001",
        date: "30 Aug 2026",
        type: "Field Inspection",
        status: "PASSED",
        inspector: "Dr. Vikram Kulkarni (District Health Officer)",
        findings: "Emergency ward dimensions verified against NHM guidelines. Masonry layout compliant.",
        evidence: "3 Photos verified"
      },
      {
        id: "INSP-002",
        date: "14 Aug 2026",
        type: "Progress Verification",
        status: "PASSED",
        inspector: "Er. Ramesh Shinde (PWD Executive Engineer)",
        findings: "Column concrete compressive strength certified to grade M-25 standard.",
        evidence: "Lab cube test attached"
      },
      {
        id: "INSP-003",
        date: "01 Aug 2026",
        type: "Site Inspection",
        status: "OBSERVATION_RAISED",
        inspector: "Assistant Engineer (Civil)",
        findings: "Observation raised regarding monsoonal water pooling near north foundation pit; contractor directed to install sump pump.",
        evidence: "Rectification notice issued"
      }
    ],
    citizenFeedback: [
      {
        id: "FB-001",
        date: "14 Aug 2026",
        citizenName: "Sanjay Mane (Haveli Resident)",
        category: "Public Access",
        message: "Requesting provision for a dedicated ambulance turnaround bay at the entrance gate.",
        location: "Haveli Ward 3",
        status: "RESOLVED",
        resolution: "Incorporated into revised civil entrance layout by Assistant Engineer.",
        rating: 5
      },
      {
        id: "FB-002",
        date: "02 Jul 2026",
        citizenName: "Sunita Patil",
        category: "Construction Noise",
        message: "Construction noise near primary school during morning examination hours.",
        location: "Haveli Main Road",
        status: "RESOLVED",
        resolution: "Heavy machinery operations restricted to afternoon hours (12 PM - 5 PM).",
        rating: 4
      }
    ],
    activity: [
      {
        id: "ACT-01",
        timestamp: "30 Aug 2026",
        actor: "BuildTech India Solutions",
        action: "Contractor uploaded 3 new milestone images",
        details: "50% milestone column casting photos submitted.",
        type: "upload"
      },
      {
        id: "ACT-02",
        timestamp: "29 Aug 2026",
        actor: "Autonomous AI Telemetry",
        action: "AI verification completed on 50% milestone",
        details: "Consistency score evaluated at 89% (Consistent).",
        type: "ai"
      },
      {
        id: "ACT-03",
        timestamp: "28 Aug 2026",
        actor: "District Treasury Officer",
        action: "Payment milestone submitted for ₹3.60 Lakhs",
        details: "Forwarded for Assistant Accounts Officer clearance.",
        type: "financial"
      },
      {
        id: "ACT-04",
        timestamp: "25 Aug 2026",
        actor: "Executive Engineer PWD",
        action: "Physical progress updated 48% → 53%",
        details: "Updated following on-site cube testing.",
        type: "progress"
      },
      {
        id: "ACT-05",
        timestamp: "22 Aug 2026",
        actor: "Dr. Vikram Kulkarni (DHO)",
        action: "Field inspection completed: PASSED",
        details: "Recorded satisfactory diagnostic room sizing.",
        type: "inspection"
      }
    ],
    aiInsights: [
      {
        id: "INS-01",
        type: "progress",
        severity: "positive",
        title: "Physical Progress Consistent with Reported Stage",
        description: "Physical progress (53%) matches active structural RCC framework detected by AI vision models.",
        recommendation: "Maintain scheduled execution pace towards September completion target."
      },
      {
        id: "INS-02",
        type: "financial",
        severity: "warning",
        title: "Financial Utilization Leads Physical Progress (+15%)",
        description: "Disbursements recorded at 68% (₹20.4L) compared to verified physical completion of 53%.",
        recommendation: "Hold subsequent tranche release until second floor slab casting is 100% certified."
      },
      {
        id: "INS-03",
        type: "schedule",
        severity: "warning",
        title: "Project is 12 Days Behind Planned Schedule",
        description: "Monsoon precipitation caused slight delay in roof curing operations.",
        recommendation: "Request contractor to deploy parallel masonry teams to regain schedule before 18 September."
      },
      {
        id: "INS-04",
        type: "evidence",
        severity: "positive",
        title: "Latest Contractor Evidence Broadly Consistent",
        description: "AI vision analysis confirms structural RCC columns with 89% confidence.",
        recommendation: "Evidence photos accepted for current milestone."
      },
      {
        id: "INS-05",
        type: "risk",
        severity: "warning",
        title: "Cost Review: 1 Expense Item Requires Verification",
        description: "Electrical utility installation claim exhibits +18% variance above standard reference rates.",
        recommendation: "Review electrical voucher before releasing final payment."
      }
    ]
  },

  // 2. Education Infrastructure (Pune MP Constituency - MP001)
  "PRJ002": {
    id: "MPLADS-PUN-2026-002",
    altId: "PRJ002",
    mpId: "MP001",
    constituencyId: "Pune",
    financialYear: "2026-27",
    title: "Primary School Science & Smart Lab",
    name: "Primary School Science & Smart Lab",
    sector: "Education Infrastructure",
    category: "Education Infrastructure",
    description: "Equipping rural higher-primary school with modern interactive digital boards, STEM laboratory equipment, optical microscopes, and high-speed satellite broadband terminal.",
    location: {
      village: "Shirur",
      area: "Shirur Zilla Parishad School",
      district: "Pune",
      constituency: "Pune",
      state: "Maharashtra",
      latitude: 18.8288,
      longitude: 74.3734,
      mapsUrl: "https://www.google.com/maps?q=18.8288,74.3734"
    },
    status: "COMPLETED",
    beneficiaries: 1800,
    dates: {
      proposalDate: "2025-04-10",
      sanctionDate: "2025-05-15",
      workOrderDate: "2025-05-28",
      startDate: "2025-06-01",
      expectedCompletionDate: "2026-01-15",
      actualCompletionDate: "2026-01-12",
      lastUpdated: "Updated 30 Aug 2026, 09:00 AM"
    },
    progress: {
      physical: 100,
      financial: 100,
      currentStage: "Commissioned & In Operation",
      lastUpdated: "Updated 30 Aug 2026, 09:00 AM"
    },
    financial: {
      estimatedCost: 2300000,
      sanctionedAmount: 2200000,
      releasedAmount: 2200000,
      utilizedAmount: 2200000,
      payments: [
        { id: "PAY-002-1", date: "2025-06-15", description: "Lab Interior Refurbishment", amount: 600000, milestoneId: "M25", status: "PAID", referenceNumber: "RBI-NEFT-20250615-4421" },
        { id: "PAY-002-2", date: "2025-09-20", description: "Smart Interactive Displays", amount: 1000000, milestoneId: "M50", status: "PAID", referenceNumber: "RBI-NEFT-20250920-5590" },
        { id: "PAY-002-3", date: "2026-01-14", description: "STEM Apparatus Delivery", amount: 600000, milestoneId: "M100", status: "PAID", referenceNumber: "RBI-NEFT-20260114-8832" }
      ]
    },
    expenditureReview: {
      categories: [
        { name: "Digital Smart Boards & Server Hardware", amount: 1000000, percentage: 45.5, status: "VERIFIED" },
        { name: "STEM Laboratory Physics/Chemistry Kits", amount: 600000, percentage: 27.3, status: "VERIFIED" },
        { name: "Classroom Ergonomic Workstations", amount: 400000, percentage: 18.2, status: "VERIFIED" },
        { name: "Satellite Broadband Terminal & Wiring", amount: 200000, percentage: 9.0, status: "VERIFIED" }
      ],
      aiCostReview: {
        status: "VERIFIED",
        verifiedCount: 4,
        reviewCount: 0,
        summary: "All 4 educational procurement expenses verified against GeM (Government e-Marketplace) rate contracts.",
        varianceItem: null
      }
    },
    risk: {
      score: 12,
      level: "LOW",
      factors: [
        { category: "Schedule Risk", score: 2, maxScore: 25, severity: "LOW", reason: "Project was completed 3 days ahead of deadline." },
        { category: "Financial Risk", score: 2, maxScore: 20, severity: "LOW", reason: "100% fund utilization with clean zero unspent balance." },
        { category: "Execution Risk", score: 2, maxScore: 20, severity: "LOW", reason: "All STEM instruments calibrated and tested in operation." },
        { category: "Evidence Risk", score: 2, maxScore: 15, severity: "LOW", reason: "Final handover images verified." },
        { category: "Citizen Feedback Risk", score: 4, maxScore: 20, severity: "LOW", reason: "Overwhelmingly positive student and teacher feedback." }
      ]
    },
    contractor: {
      id: "CON002",
      name: "Vanguard Tech & EdTech Solutions",
      registrationNumber: "KA-REG-2021-4432",
      workOrderNumber: "WO-PUN-2025-112",
      performanceScore: 98,
      riskLevel: "Low",
      status: "Completed",
      assignedProjects: 2,
      completedProjects: 15,
      delayedProjects: 0,
      onTimePercentage: 100,
      delaySignal: null,
      contactPerson: "Priya Nair",
      phone: "+91 98450 33441",
      email: "info@vanguardtech.demo"
    },
    milestoneTracks: [
      { id: "M25", percentage: 25, label: "25% Milestone", stageName: "Classroom Interior Refurbishment", status: "COMPLETED", photoCount: 1, photosUploaded: true },
      { id: "M50", percentage: 50, label: "50% Milestone", stageName: "Interactive Smart Panels Installation", status: "COMPLETED", photoCount: 1, photosUploaded: true },
      { id: "M75", percentage: 75, label: "75% Milestone", stageName: "STEM Laboratory Equipment", status: "COMPLETED", photoCount: 1, photosUploaded: true },
      { id: "M100", percentage: 100, label: "100% Milestone", stageName: "Commissioning & Student Handover", status: "COMPLETED", photoCount: 1, photosUploaded: true }
    ],
    milestones: [
      { id: "M1", name: "Procurement & Site Preparation", status: "COMPLETED", progress: 100, plannedStartDate: "2025-06-01", plannedEndDate: "2025-07-01", actualStartDate: "2025-06-01", actualEndDate: "2025-06-25" },
      { id: "M2", name: "Interactive Smart Panels & Server Setup", status: "COMPLETED", progress: 100, plannedStartDate: "2025-07-15", plannedEndDate: "2025-10-15", actualStartDate: "2025-07-15", actualEndDate: "2025-10-10" },
      { id: "M3", name: "STEM Kits & Commissioning", status: "COMPLETED", progress: 100, plannedStartDate: "2025-10-20", plannedEndDate: "2026-01-15", actualStartDate: "2025-10-20", actualEndDate: "2026-01-12" }
    ],
    timeline: [
      { id: "T1", stage: "Proposal Submitted", title: "Project Sanctioned & Approved", date: "15 May 2025", status: "COMPLETED" },
      { id: "T2", stage: "Work Order Issued", title: "Vendor Commissioned", date: "28 May 2025", status: "COMPLETED" },
      { id: "T3", stage: "Completion", title: "Lab Commissioned for Students", date: "15 Jan 2026", status: "COMPLETED" }
    ],
    evidence: [
      {
        id: "EVD-02-1",
        milestoneId: "M100",
        milestoneName: "STEM Kits & Commissioning",
        photoNumber: "PHOTO #01",
        imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80",
        thumbnailUrl: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=400&q=80",
        uploadedAt: "12 Jan 2026, 03:00 PM",
        uploadedBy: "Vanguard Tech & EdTech Solutions",
        contractorId: "CON002",
        location: "Shirur ZP High School Lab Hall",
        gpsCoordinates: "18.8288° N, 74.3734° E",
        description: "Finished STEM laboratory with 20 student workstations and smart interactive display.",
        verificationStatus: "VERIFIED",
        aiAnalysis: {
          summary: "Completed educational lab facility with digital smart displays and laboratory tables.",
          detectedObjects: ["Interactive touch panel", "Laboratory benches", "Microscopes", "Student desks", "Science models"],
          detectedActivities: ["Classroom operational readiness"],
          estimatedStage: "Fully Commissioned Facility",
          estimatedProgress: 100,
          contractorReported: 100,
          confidence: 97,
          consistency: { status: "CONSISTENT", difference: 0, explanation: "All equipment operational." },
          observations: ["All 20 workstations equipped with electrical supply and safety cutoffs."]
        }
      }
    ],
    documents: [
      { id: "D1", name: "Final Completion & Handover Certificate", type: "Completion documents", uploadedAt: "15 Jan 2026", status: "APPROVED", fileSize: "1.1 MB" }
    ],
    inspections: [
      { id: "I1", date: "12 Jan 2026", type: "Field Inspection", status: "PASSED", inspector: "Block Education Officer (Shirur)", findings: "All 30 tablets and smart boards certified in working order.", evidence: "Handover sign-off attached" }
    ],
    citizenFeedback: [
      { id: "F1", date: "20 Jan 2026", citizenName: "Mahesh Deshpande (Headmaster)", category: "Appreciation", message: "Over 450 students are now using the STEM laboratory weekly.", location: "Shirur ZP School", status: "RESOLVED", rating: 5 }
    ],
    activity: [
      { id: "A1", timestamp: "15 Jan 2026", actor: "District Education Office", action: "Project marked COMPLETED & Handed Over", details: "Handover certificate accepted.", type: "sanction" }
    ],
    aiInsights: [
      { id: "IN1", type: "progress", severity: "positive", title: "Project Fully Commissioned", description: "All deliverables met with 100% financial and physical completion.", recommendation: "Conduct 6-month post-commissioning usage survey." }
    ]
  },

  // 3. Varanasi Constituency Project (MP002 - Varanasi) -> FOR TESTING CONSTITUENCY RESTRICTION
  "PRJ006": {
    id: "MPLADS-VAR-2026-006",
    altId: "PRJ006",
    mpId: "MP002",
    constituencyId: "Varanasi",
    financialYear: "2026-27",
    title: "Handloom Craftsmen Common Facility Centre",
    name: "Handloom Craftsmen Common Facility Centre",
    sector: "Community Assets",
    description: "Artisan hub with automated yarn dyeing units and solar loom sheds for 450 handloom weaver families.",
    location: {
      village: "Lohta",
      area: "Lohta Weavers Cluster",
      district: "Varanasi",
      constituency: "Varanasi",
      state: "Uttar Pradesh",
      latitude: 25.3211,
      longitude: 82.9341
    },
    status: "ONGOING",
    beneficiaries: 6200,
    dates: {
      proposalDate: "2025-11-01",
      sanctionDate: "2026-01-10",
      workOrderDate: "2026-01-20",
      startDate: "2026-01-20",
      expectedCompletionDate: "2026-12-15",
      actualCompletionDate: null,
      lastUpdated: "Updated 30 Aug 2026, 09:45 AM"
    },
    progress: { physical: 35, financial: 72.0, currentStage: "Plinth & Incomplete Shed Frame" },
    financial: { estimatedCost: 5500000, sanctionedAmount: 5000000, releasedAmount: 4000000, utilizedAmount: 3600000, payments: [] },
    risk: { score: 82, level: "CRITICAL", factors: [] },
    contractor: { id: "CON005", name: "Eastern Heritage Infra Projects", performanceScore: 54, status: "Ongoing" },
    milestoneTracks: [],
    milestones: [],
    timeline: [],
    evidence: [],
    documents: [],
    inspections: [],
    citizenFeedback: [],
    activity: [],
    aiInsights: []
  }
};
