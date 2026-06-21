import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name }: { name: string }) => {
    const { View } = require("react-native");
    return <View testID={`feather-${name}`} />;
  },
}));

import ShareCard from "@/components/ShareCard";

const BASE_PROPS = {
  sessions:   3,
  weeklyGoal: 5,
  streakDays: 0,
};

describe("ProgressShareCard — sport label title case", () => {
  it("renders a lowercase raw sport value in title case", () => {
    const { getByText } = render(<ShareCard {...BASE_PROPS} sport="running" />);
    expect(getByText("Running")).toBeTruthy();
  });

  it("never renders the raw lowercase sport value", () => {
    const { queryByText } = render(<ShareCard {...BASE_PROPS} sport="running" />);
    expect(queryByText("running")).toBeNull();
  });

  it("renders 'Swimming' when sport is 'swimming'", () => {
    const { getByText } = render(<ShareCard {...BASE_PROPS} sport="swimming" />);
    expect(getByText("Swimming")).toBeTruthy();
  });

  it("does not render the raw 'swimming' value", () => {
    const { queryByText } = render(<ShareCard {...BASE_PROPS} sport="swimming" />);
    expect(queryByText("swimming")).toBeNull();
  });

  it("renders 'Cycling' when sport is 'cycling'", () => {
    const { getByText } = render(<ShareCard {...BASE_PROPS} sport="cycling" />);
    expect(getByText("Cycling")).toBeTruthy();
  });

  it("renders 'Basketball' when sport is 'basketball'", () => {
    const { getByText } = render(<ShareCard {...BASE_PROPS} sport="basketball" />);
    expect(getByText("Basketball")).toBeTruthy();
  });

  it("renders 'Yoga' when sport is 'yoga'", () => {
    const { getByText } = render(<ShareCard {...BASE_PROPS} sport="yoga" />);
    expect(getByText("Yoga")).toBeTruthy();
  });

  it("renders 'Tennis' when sport is 'tennis'", () => {
    const { getByText } = render(<ShareCard {...BASE_PROPS} sport="tennis" />);
    expect(getByText("Tennis")).toBeTruthy();
  });

  it("renders a multi-word sport in title case", () => {
    const { getByText } = render(<ShareCard {...BASE_PROPS} sport="weight lifting" />);
    expect(getByText("Weight Lifting")).toBeTruthy();
  });

  it("does not render the raw multi-word sport value", () => {
    const { queryByText } = render(<ShareCard {...BASE_PROPS} sport="weight lifting" />);
    expect(queryByText("weight lifting")).toBeNull();
  });
});

describe("ProgressShareCard — renders without crashing", () => {
  it("renders with no topTip", () => {
    expect(() => {
      render(<ShareCard {...BASE_PROPS} sport="running" />);
    }).not.toThrow();
  });

  it("renders with a topTip", () => {
    const tip = "Keep your hips high and drive your knees forward.";
    const { getByText } = render(<ShareCard {...BASE_PROPS} sport="running" topTip={tip} />);
    expect(getByText(tip)).toBeTruthy();
  });

  it("renders a streak badge when streakDays > 0", () => {
    expect(() => {
      render(<ShareCard {...BASE_PROPS} sport="running" streakDays={7} />);
    }).not.toThrow();
  });
});
