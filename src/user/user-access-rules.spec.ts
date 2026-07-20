import {
    getUserProfileReadDenialReason,USER_PROFILE_ACCESS_DENIED_MESSAGE
} from "./user-access-rules";
import {UserRole} from "./interfaces/user.interface";

describe('interview-access-rules', () => {
    const superAdmin = { id: 'r2d2' , role: 'super_admin'as UserRole };
    const superAdmin2 = { id: 'r2d3' , role: 'super_admin'as UserRole };
    const admin = { id: 'c3po' , role: 'admin'as UserRole };
    const admin2 = { id: 'c3po2' , role: 'admin'as UserRole };
    const hr = { id: 'bb8' , role: 'hr'as UserRole };
    const hr2 = { id: 'bb4' , role: 'hr'as UserRole };
    const candidate1 = { id: 'bb5' , role: 'candidate'as UserRole };
    const candidate2 = { id: 'bb7' , role: 'candidate'as UserRole };

    it('allows super_admin to access everyone', () => {
        expect(
            getUserProfileReadDenialReason(admin, superAdmin ),
        ).toBeNull();
        expect(
            getUserProfileReadDenialReason(superAdmin2, superAdmin ),
        ).toBeNull();
        expect(
            getUserProfileReadDenialReason(hr, superAdmin ),
        ).toBeNull();
        expect(
            getUserProfileReadDenialReason(candidate1, superAdmin ),
        ).toBeNull();
    });

    it('admin can access anyone but super_admin', () => {
        expect(
            getUserProfileReadDenialReason(admin2, admin ),
        ).toBeNull();
        expect(
            getUserProfileReadDenialReason(hr, admin ),
        ).toBeNull();
        expect(
            getUserProfileReadDenialReason(candidate2, admin ),
        ).toBeNull();
        expect(
            getUserProfileReadDenialReason(superAdmin, admin ),
        ).toBe(USER_PROFILE_ACCESS_DENIED_MESSAGE);
    });

    it('hr can only access hrs and candidates', () => {
        expect(
            getUserProfileReadDenialReason(superAdmin, hr ),
        ).toBe(USER_PROFILE_ACCESS_DENIED_MESSAGE);
        expect(
            getUserProfileReadDenialReason(admin, hr ),
        ).toBe(USER_PROFILE_ACCESS_DENIED_MESSAGE);
        expect(
            getUserProfileReadDenialReason(hr2, hr ),
        ).toBeNull();
        expect(
            getUserProfileReadDenialReason(candidate2, hr ),
        ).toBeNull();
    });

    it('candidate can access to only their own profile', () => {
        expect(
            getUserProfileReadDenialReason(superAdmin, candidate1 ),
        ).toBe(USER_PROFILE_ACCESS_DENIED_MESSAGE);
        expect(
            getUserProfileReadDenialReason(admin, candidate1 ),
        ).toBe(USER_PROFILE_ACCESS_DENIED_MESSAGE);
        expect(
            getUserProfileReadDenialReason(hr2, candidate1 ),
        ).toBe(USER_PROFILE_ACCESS_DENIED_MESSAGE);
        expect(
            getUserProfileReadDenialReason(candidate2, candidate1 ),
        ).toBe(USER_PROFILE_ACCESS_DENIED_MESSAGE);
        expect(
            getUserProfileReadDenialReason(candidate1, candidate1 ),
        ).toBeNull();
    });

});
