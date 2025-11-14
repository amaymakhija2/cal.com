import { sendVerificationCode } from "@calcom/features/ee/workflows/lib/reminders/verifyPhoneNumber";
import { IS_SELF_HOSTED } from "@calcom/lib/constants";
import hasKeyInMetadata from "@calcom/lib/hasKeyInMetadata";
import { CreditsRepository } from "@calcom/lib/server/repository/credits";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";

import { TRPCError } from "@trpc/server";

import { hasTeamPlanHandler } from "../teams/hasTeamPlan.handler";
import type { TSendVerificationCodeInputSchema } from "./sendVerificationCode.schema";

type SendVerificationCodeOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TSendVerificationCodeInputSchema;
};

export const sendVerificationCodeHandler = async ({ ctx, input }: SendVerificationCodeOptions) => {
  // Self-hosted instances bypass credit/plan checks for SMS verification
  if (IS_SELF_HOSTED) {
    const { phoneNumber } = input;
    return sendVerificationCode(phoneNumber);
  }

  const { user } = ctx;

  const isCurrentUsernamePremium =
    user && hasKeyInMetadata(user, "isPremium") ? !!user.metadata.isPremium : false;

  const creditBalance = await CreditsRepository.findCreditBalance({ userId: user.id });
  const hasNoAdditionalCredits = !!creditBalance && creditBalance.additionalCredits <= 0;

  let isTeamsPlan = false;
  if (!isCurrentUsernamePremium) {
    const { hasTeamPlan } = await hasTeamPlanHandler({ ctx });
    isTeamsPlan = !!hasTeamPlan;
  }

  if (!isCurrentUsernamePremium && !isTeamsPlan && hasNoAdditionalCredits) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const { phoneNumber } = input;
  return sendVerificationCode(phoneNumber);
};
