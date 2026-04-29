export const EFFECT_PARAMETER_REGISTRY_BUNDLE = {
  "artifactType": "sequencer_effect_parameter_registry_bundle",
  "artifactVersion": "1.0",
  "sourcePath": "/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/catalog/effective-effect-parameter-registry.json",
  "sourceVersion": "1.0",
  "generatedAt": "2026-04-27T18:06:45.073Z",
  "effectCount": 18,
  "effects": {
    "Bars": {
      "complexityClass": "complex",
      "parameters": {
        "3d": {
          "parameterName": "3D",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Bars_3D",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "barcount": {
          "parameterName": "barCount",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Bars_BarCount",
          "defaultValue": 1,
          "min": 1,
          "max": 5,
          "divisor": 1
        },
        "cycles": {
          "parameterName": "cycles",
          "type": "float",
          "controlType": "slider",
          "upstreamId": "Bars_Cycles",
          "defaultValue": 1,
          "min": 0,
          "max": 300,
          "divisor": 10
        },
        "direction": {
          "parameterName": "direction",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Bars_Direction",
          "defaultValue": "up",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "gradient": {
          "parameterName": "gradient",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Bars_Gradient",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "highlight": {
          "parameterName": "highlight",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Bars_Highlight",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        }
      }
    },
    "Butterfly": {
      "complexityClass": "complex",
      "parameters": {
        "chunks": {
          "parameterName": "chunks",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Butterfly_Chunks",
          "defaultValue": 1,
          "min": 1,
          "max": 10,
          "divisor": 1
        },
        "colors": {
          "parameterName": "colors",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Butterfly_Colors",
          "defaultValue": "Rainbow",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "direction": {
          "parameterName": "direction",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Butterfly_Direction",
          "defaultValue": "Normal",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "speed": {
          "parameterName": "speed",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Butterfly_Speed",
          "defaultValue": 10,
          "min": 0,
          "max": 100,
          "divisor": 1
        },
        "style": {
          "parameterName": "style",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Butterfly_Style",
          "defaultValue": 1,
          "min": 1,
          "max": 10,
          "divisor": 1
        }
      }
    },
    "Circles": {
      "complexityClass": "complex",
      "parameters": {
        "bounce": {
          "parameterName": "bounce",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Circles_Bounce",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "count": {
          "parameterName": "count",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Circles_Count",
          "defaultValue": 3,
          "min": 1,
          "max": 10,
          "divisor": 1
        },
        "radial": {
          "parameterName": "radial",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Circles_Radial",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "size": {
          "parameterName": "size",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Circles_Size",
          "defaultValue": 5,
          "min": 1,
          "max": 20,
          "divisor": 1
        },
        "speed": {
          "parameterName": "speed",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Circles_Speed",
          "defaultValue": 10,
          "min": 1,
          "max": 30,
          "divisor": 1
        }
      }
    },
    "Color Wash": {
      "complexityClass": "moderate",
      "parameters": {
        "circularpalette": {
          "parameterName": "circularPalette",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "ColorWash_CircularPalette",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "cycles": {
          "parameterName": "cycles",
          "type": "float",
          "controlType": "slider",
          "upstreamId": "ColorWash_Cycles",
          "defaultValue": 1,
          "min": 1,
          "max": 200,
          "divisor": 10
        },
        "hfade": {
          "parameterName": "hFade",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "ColorWash_HFade",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "reversefades": {
          "parameterName": "reverseFades",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "ColorWash_ReverseFades",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "shimmer": {
          "parameterName": "shimmer",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "ColorWash_Shimmer",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "vfade": {
          "parameterName": "vFade",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "ColorWash_VFade",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        }
      }
    },
    "Fire": {
      "complexityClass": "complex",
      "parameters": {
        "growthcycles": {
          "parameterName": "growthCycles",
          "type": "float",
          "controlType": "slider",
          "upstreamId": "Fire_GrowthCycles",
          "defaultValue": 0,
          "min": 0,
          "max": 200,
          "divisor": 10
        },
        "height": {
          "parameterName": "height",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Fire_Height",
          "defaultValue": 50,
          "min": 1,
          "max": 100,
          "divisor": 1
        },
        "hueshift": {
          "parameterName": "hueShift",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Fire_HueShift",
          "defaultValue": 0,
          "min": 0,
          "max": 100,
          "divisor": 1
        },
        "location": {
          "parameterName": "location",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Fire_Location",
          "defaultValue": "Bottom",
          "min": 0,
          "max": 0,
          "divisor": 1
        }
      }
    },
    "Fireworks": {
      "complexityClass": "complex",
      "parameters": {
        "count": {
          "parameterName": "count",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Fireworks_Count",
          "defaultValue": 50,
          "min": 1,
          "max": 100,
          "divisor": 1
        },
        "explosions": {
          "parameterName": "explosions",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Fireworks_Explosions",
          "defaultValue": 16,
          "min": 1,
          "max": 50,
          "divisor": 1
        },
        "fade": {
          "parameterName": "fade",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Fireworks_Fade",
          "defaultValue": 50,
          "min": 1,
          "max": 100,
          "divisor": 1
        },
        "gravity": {
          "parameterName": "gravity",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Fireworks_Gravity",
          "defaultValue": true,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "velocity": {
          "parameterName": "velocity",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Fireworks_Velocity",
          "defaultValue": 2,
          "min": 1,
          "max": 10,
          "divisor": 1
        },
        "xlocation": {
          "parameterName": "xLocation",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Fireworks_XLocation",
          "defaultValue": -1,
          "min": -1,
          "max": 100,
          "divisor": 1
        }
      }
    },
    "Lightning": {
      "complexityClass": "complex",
      "parameters": {
        "direction": {
          "parameterName": "direction",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Lightning_Direction",
          "defaultValue": "Up",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "forked": {
          "parameterName": "forked",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "ForkedLightning",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "numberbolts": {
          "parameterName": "numberBolts",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Number_Bolts",
          "defaultValue": 10,
          "min": 1,
          "max": 50,
          "divisor": 1
        },
        "numbersegments": {
          "parameterName": "numberSegments",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Number_Segments",
          "defaultValue": 5,
          "min": 1,
          "max": 20,
          "divisor": 1
        },
        "width": {
          "parameterName": "width",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Lightning_WIDTH",
          "defaultValue": 1,
          "min": 1,
          "max": 7,
          "divisor": 1
        }
      }
    },
    "Marquee": {
      "complexityClass": "complex",
      "parameters": {
        "bandsize": {
          "parameterName": "bandSize",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Marquee_Band_Size",
          "defaultValue": 3,
          "min": 1,
          "max": 100,
          "divisor": 1
        },
        "reverse": {
          "parameterName": "reverse",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Marquee_Reverse",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "skipsize": {
          "parameterName": "skipSize",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Marquee_Skip_Size",
          "defaultValue": 0,
          "min": 0,
          "max": 100,
          "divisor": 1
        },
        "speed": {
          "parameterName": "speed",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Marquee_Speed",
          "defaultValue": 3,
          "min": 0,
          "max": 50,
          "divisor": 1
        },
        "stagger": {
          "parameterName": "stagger",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Marquee_Stagger",
          "defaultValue": 0,
          "min": 0,
          "max": 50,
          "divisor": 1
        },
        "thickness": {
          "parameterName": "thickness",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Marquee_Thickness",
          "defaultValue": 1,
          "min": 1,
          "max": 100,
          "divisor": 1
        }
      }
    },
    "On": {
      "complexityClass": "simple",
      "parameters": {
        "cycles": {
          "parameterName": "cycles",
          "type": "float",
          "controlType": "slider",
          "upstreamId": "On_Cycles",
          "defaultValue": 1,
          "min": 0,
          "max": 1000,
          "divisor": 10
        },
        "endlevel": {
          "parameterName": "endLevel",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Eff_On_End",
          "defaultValue": 100,
          "min": 0,
          "max": 100,
          "divisor": 1
        },
        "shimmer": {
          "parameterName": "shimmer",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "On_Shimmer",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "startlevel": {
          "parameterName": "startLevel",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Eff_On_Start",
          "defaultValue": 100,
          "min": 0,
          "max": 100,
          "divisor": 1
        }
      }
    },
    "Pinwheel": {
      "complexityClass": "complex",
      "parameters": {
        "3dmode": {
          "parameterName": "3DMode",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Pinwheel_3D",
          "defaultValue": "None",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "arms": {
          "parameterName": "arms",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Pinwheel_Arms",
          "defaultValue": 3,
          "min": 1,
          "max": 20,
          "divisor": 1
        },
        "armsize": {
          "parameterName": "armSize",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Pinwheel_ArmSize",
          "defaultValue": 100,
          "min": 0,
          "max": 400,
          "divisor": 1
        },
        "rotation": {
          "parameterName": "rotation",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Pinwheel_Rotation",
          "defaultValue": true,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "speed": {
          "parameterName": "speed",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Pinwheel_Speed",
          "defaultValue": 10,
          "min": 0,
          "max": 50,
          "divisor": 1
        },
        "style": {
          "parameterName": "style",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Pinwheel_Style",
          "defaultValue": "New Render Method",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "thickness": {
          "parameterName": "thickness",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Pinwheel_Thickness",
          "defaultValue": 0,
          "min": 0,
          "max": 100,
          "divisor": 1
        },
        "twist": {
          "parameterName": "twist",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Pinwheel_Twist",
          "defaultValue": 0,
          "min": -360,
          "max": 360,
          "divisor": 1
        }
      }
    },
    "Shimmer": {
      "complexityClass": "simple",
      "parameters": {
        "cycles": {
          "parameterName": "cycles",
          "type": "float",
          "controlType": "slider",
          "upstreamId": "Shimmer_Cycles",
          "defaultValue": 1,
          "min": 0,
          "max": 6000,
          "divisor": 10
        },
        "dutyfactor": {
          "parameterName": "dutyFactor",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Shimmer_Duty_Factor",
          "defaultValue": 50,
          "min": 1,
          "max": 100,
          "divisor": 1
        },
        "useallcolors": {
          "parameterName": "useAllColors",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Shimmer_Use_All_Colors",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        }
      }
    },
    "Shockwave": {
      "complexityClass": "complex",
      "parameters": {
        "accel": {
          "parameterName": "accel",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Shockwave_Accel",
          "defaultValue": 0,
          "min": -10,
          "max": 10,
          "divisor": 1
        },
        "blendedges": {
          "parameterName": "blendEdges",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Shockwave_Blend_Edges",
          "defaultValue": true,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "centerx": {
          "parameterName": "centerX",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Shockwave_CenterX",
          "defaultValue": 50,
          "min": 0,
          "max": 100,
          "divisor": 1
        },
        "centery": {
          "parameterName": "centerY",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Shockwave_CenterY",
          "defaultValue": 50,
          "min": 0,
          "max": 100,
          "divisor": 1
        },
        "cycles": {
          "parameterName": "cycles",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Shockwave_Cycles",
          "defaultValue": 1,
          "min": 1,
          "max": 100,
          "divisor": 1
        },
        "endradius": {
          "parameterName": "endRadius",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Shockwave_End_Radius",
          "defaultValue": 10,
          "min": 0,
          "max": 750,
          "divisor": 1
        },
        "endwidth": {
          "parameterName": "endWidth",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Shockwave_End_Width",
          "defaultValue": 10,
          "min": 0,
          "max": 255,
          "divisor": 1
        },
        "scale": {
          "parameterName": "scale",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Shockwave_Scale",
          "defaultValue": true,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "startradius": {
          "parameterName": "startRadius",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Shockwave_Start_Radius",
          "defaultValue": 1,
          "min": 0,
          "max": 750,
          "divisor": 1
        },
        "startwidth": {
          "parameterName": "startWidth",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Shockwave_Start_Width",
          "defaultValue": 5,
          "min": 0,
          "max": 255,
          "divisor": 1
        }
      }
    },
    "SingleStrand": {
      "complexityClass": "moderate",
      "parameters": {
        "advances": {
          "parameterName": "advances",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Skips_Advance",
          "defaultValue": 0,
          "min": 0,
          "max": 100,
          "divisor": 1
        },
        "bandsize": {
          "parameterName": "bandSize",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Skips_BandSize",
          "defaultValue": 1,
          "min": 1,
          "max": 20,
          "divisor": 1
        },
        "chasesize": {
          "parameterName": "chaseSize",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Color_Mix1",
          "defaultValue": 10,
          "min": 1,
          "max": 100,
          "divisor": 1
        },
        "chasetype": {
          "parameterName": "chaseType",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Chase_Type1",
          "defaultValue": "Left-Right",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "cycles": {
          "parameterName": "cycles",
          "type": "float",
          "controlType": "slider",
          "upstreamId": "Chase_Rotations",
          "defaultValue": 1,
          "min": 1,
          "max": 500,
          "divisor": 10
        },
        "fadetype": {
          "parameterName": "fadeType",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Fade_Type",
          "defaultValue": "None",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "intensity": {
          "parameterName": "intensity",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "FX_Intensity",
          "defaultValue": 128,
          "min": 0,
          "max": 255,
          "divisor": 1
        },
        "mode": {
          "parameterName": "mode",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "SingleStrand_Colors",
          "defaultValue": "Palette",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "numberchases": {
          "parameterName": "numberChases",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Number_Chases",
          "defaultValue": 1,
          "min": 1,
          "max": 20,
          "divisor": 1
        },
        "skipsize": {
          "parameterName": "skipSize",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Skips_SkipSize",
          "defaultValue": 1,
          "min": 0,
          "max": 20,
          "divisor": 1
        }
      }
    },
    "Snowflakes": {
      "complexityClass": "moderate",
      "parameters": {
        "count": {
          "parameterName": "count",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Snowflakes_Count",
          "defaultValue": 5,
          "min": 1,
          "max": 100,
          "divisor": 1
        },
        "falling": {
          "parameterName": "falling",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Falling",
          "defaultValue": "Driving",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "speed": {
          "parameterName": "speed",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Snowflakes_Speed",
          "defaultValue": 10,
          "min": 0,
          "max": 50,
          "divisor": 1
        },
        "type": {
          "parameterName": "type",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Snowflakes_Type",
          "defaultValue": 1,
          "min": 0,
          "max": 9,
          "divisor": 1
        }
      }
    },
    "Spirals": {
      "complexityClass": "complex",
      "parameters": {
        "3d": {
          "parameterName": "3D",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Spirals_3D",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "blend": {
          "parameterName": "blend",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Spirals_Blend",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "count": {
          "parameterName": "count",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Spirals_Count",
          "defaultValue": 1,
          "min": 1,
          "max": 5,
          "divisor": 1
        },
        "grow": {
          "parameterName": "grow",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Spirals_Grow",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "movement": {
          "parameterName": "movement",
          "type": "float",
          "controlType": "slider",
          "upstreamId": "Spirals_Movement",
          "defaultValue": 1,
          "min": -200,
          "max": 200,
          "divisor": 10
        },
        "rotation": {
          "parameterName": "rotation",
          "type": "float",
          "controlType": "slider",
          "upstreamId": "Spirals_Rotation",
          "defaultValue": 2,
          "min": -300,
          "max": 300,
          "divisor": 10
        },
        "shrink": {
          "parameterName": "shrink",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Spirals_Shrink",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "thickness": {
          "parameterName": "thickness",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Spirals_Thickness",
          "defaultValue": 50,
          "min": 0,
          "max": 100,
          "divisor": 1
        }
      }
    },
    "Strobe": {
      "complexityClass": "moderate",
      "parameters": {
        "duration": {
          "parameterName": "duration",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Strobe_Duration",
          "defaultValue": 10,
          "min": 1,
          "max": 100,
          "divisor": 1
        },
        "numberstrobes": {
          "parameterName": "numberStrobes",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Number_Strobes",
          "defaultValue": 3,
          "min": 1,
          "max": 300,
          "divisor": 1
        },
        "type": {
          "parameterName": "type",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Strobe_Type",
          "defaultValue": 1,
          "min": 1,
          "max": 4,
          "divisor": 1
        }
      }
    },
    "Twinkle": {
      "complexityClass": "complex",
      "parameters": {
        "count": {
          "parameterName": "count",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Twinkle_Count",
          "defaultValue": 3,
          "min": 2,
          "max": 100,
          "divisor": 1
        },
        "rerandomize": {
          "parameterName": "reRandomize",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Twinkle_ReRandom",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "steps": {
          "parameterName": "steps",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Twinkle_Steps",
          "defaultValue": 30,
          "min": 2,
          "max": 400,
          "divisor": 1
        },
        "strobe": {
          "parameterName": "strobe",
          "type": "bool",
          "controlType": "checkbox",
          "upstreamId": "Twinkle_Strobe",
          "defaultValue": false,
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "style": {
          "parameterName": "style",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Twinkle_Style",
          "defaultValue": "New Render Method",
          "min": 0,
          "max": 0,
          "divisor": 1
        }
      }
    },
    "Wave": {
      "complexityClass": "complex",
      "parameters": {
        "direction": {
          "parameterName": "direction",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Wave_Direction",
          "defaultValue": "Right to Left",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "fillcolors": {
          "parameterName": "fillColors",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Fill_Colors",
          "defaultValue": "None",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "numberwaves": {
          "parameterName": "numberWaves",
          "type": "float",
          "controlType": "slider",
          "upstreamId": "Number_Waves",
          "defaultValue": 2.5,
          "min": 180,
          "max": 3600,
          "divisor": 360
        },
        "type": {
          "parameterName": "type",
          "type": "enum",
          "controlType": "choice",
          "upstreamId": "Wave_Type",
          "defaultValue": "Sine",
          "min": 0,
          "max": 0,
          "divisor": 1
        },
        "waveheight": {
          "parameterName": "waveHeight",
          "type": "int",
          "controlType": "slider",
          "upstreamId": "Wave_Height",
          "defaultValue": 50,
          "min": 0,
          "max": 100,
          "divisor": 1
        },
        "wavespeed": {
          "parameterName": "waveSpeed",
          "type": "float",
          "controlType": "slider",
          "upstreamId": "Wave_Speed",
          "defaultValue": 10,
          "min": 0,
          "max": 5000,
          "divisor": 100
        }
      }
    }
  }
};
