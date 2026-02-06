import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const alertSchema = new Schema(
  {
    deviceSerial: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v: unknown) => typeof v === "string" && /^\d{10}$/.test(v),
        message: "deviceSerial must be exactly 10 digits",
      },
    },
    timestamp: {
      type: Date,
      required: true,
    },
    metric: {
      type: String,
      enum: ["voltage"],
      required: true,
      default: "voltage",
    },
    value: {
      type: Number,
      required: true,
    },
    threshold: {
      type: Number,
      required: true,
    },
    severity: {
      type: String,
      enum: ["warning"],
      required: true,
      default: "warning",
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export type AlertDocument = InferSchemaType<typeof alertSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Alert: Model<AlertDocument> =
  (mongoose.models.Alert as Model<AlertDocument>) ||
  mongoose.model<AlertDocument>("Alert", alertSchema);
