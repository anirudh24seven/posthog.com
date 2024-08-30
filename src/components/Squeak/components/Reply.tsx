import React, { useContext, useMemo, useState } from 'react'
import { useUser } from 'hooks/useUser'
import Days from './Days'
import Markdown from './Markdown'
import { StrapiRecord, ReplyData } from 'lib/strapi'
import Avatar from './Avatar'
import getAvatarURL from '../util/getAvatar'
import { CurrentQuestionContext } from './Question'
import Link from 'components/Link'
import Logomark from 'components/Home/images/Logomark'
import { CallToAction } from 'components/CallToAction'
import { IconThumbsDown, IconThumbsUp } from '@posthog/icons'
import usePostHog from 'hooks/usePostHog'

type ReplyProps = {
    reply: StrapiRecord<ReplyData>
    badgeText?: string | null
    className?: string
}

const AIDisclaimer = ({ replyID, refresh }) => {
    const posthog = usePostHog()
    const { getJwt } = useUser()
    const { handleResolve } = useContext(CurrentQuestionContext)
    const [helpful, setHelpful] = useState<boolean | null>(null)

    const handleHelpful = async (helpful: boolean) => {
        try {
            setHelpful(helpful)
            posthog?.capture('Community AI reply', {
                replyID,
                helpful,
            })

            await fetch(`${process.env.GATSBY_SQUEAK_API_HOST}/api/replies/${replyID}`, {
                method: 'PUT',
                body: JSON.stringify({
                    data: {
                        helpful,
                    },
                }),
                headers: {
                    'content-type': 'application/json',
                    Authorization: `Bearer ${await getJwt()}`,
                },
            })

            await handleResolve(helpful, replyID)

            refresh()
        } catch (error) {
            console.error(error)
        }
    }

    return (
        <div className="p-4 border border-border dark:border-dark rounded-md bg-accent dark:bg-accent-dark mb-2">
            <p className="m-0 text-sm">
                {helpful === null ? (
                    <>
                        <strong>This answer was auto-generated by AI.</strong> Let us know if it helped!
                    </>
                ) : helpful ? (
                    <>
                        <strong>Great to hear!</strong> Response generate by{' '}
                        <Link to="https://inkeep.com" externalNoIcon>
                            Inkeep
                        </Link>
                        .
                    </>
                ) : (
                    <>
                        <strong>Sorry to hear!</strong> Your question has been posted to our community and our AI
                        response will be analyzed so we can do better in the future.
                    </>
                )}
            </p>
            {helpful === null && (
                <div className="flex items-center space-x-2 mt-2">
                    <CallToAction size="sm" type="secondary" onClick={() => handleHelpful(true)}>
                        <span className="flex space-x-1 items-center">
                            <IconThumbsUp className="size-4 text-green flex-shrink-0" />
                            <span>Yes, mark as solution</span>
                        </span>
                    </CallToAction>
                    <CallToAction size="sm" type="secondary" onClick={() => handleHelpful(false)}>
                        <span className="flex space-x-1 items-center">
                            <IconThumbsDown className="size-4 text-red flex-shrink-0" />
                            <span>No, request human review</span>
                        </span>
                    </CallToAction>
                </div>
            )}
        </div>
    )
}

export default function Reply({ reply, badgeText }: ReplyProps) {
    const {
        id,
        attributes: { body, createdAt, profile, publishedAt },
    } = reply

    const {
        question: { resolvedBy, id: questionID, profile: questionProfile, resolved, topics },
        handlePublishReply,
        handleResolve,
        handleReplyDelete,
        mutate,
    } = useContext(CurrentQuestionContext)

    const [confirmDelete, setConfirmDelete] = useState(false)
    const { user } = useUser()
    const isModerator = user?.role?.type === 'moderator'
    const isAuthor = user?.profile?.id === questionProfile?.data?.id
    const isTeamMember = profile?.data?.attributes?.teams?.data?.length > 0
    const resolvable =
        !resolved &&
        (isAuthor || isModerator) &&
        topics?.data?.every((topic) => !topic.attributes.label.startsWith('#'))

    const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        if (confirmDelete) {
            await handleReplyDelete(id)
        } else {
            setConfirmDelete(true)
        }
    }

    const handleContainerClick = () => {
        setConfirmDelete(false)
    }

    const pronouns = profile?.data?.attributes?.pronouns
    const helpful = useMemo(() => reply?.attributes?.helpful, [])

    return profile?.data ? (
        <div onClick={handleContainerClick}>
            <div className="pb-1 flex items-center space-x-2">
                <Link
                    className="flex items-center !text-black dark:!text-white"
                    to={`/community/profiles/${profile.data.id}`}
                >
                    <div className="mr-2 relative">
                        <Avatar
                            className="w-[25px] h-[25px] rounded-full"
                            image={getAvatarURL(profile?.data?.attributes)}
                        />
                        {isTeamMember && (
                            <span className="absolute -right-1.5 -bottom-2 h-[20px] w-[20px] flex items-center justify-center rounded-full bg-white dark:bg-gray-accent-dark text-primary dark:text-primary-dark">
                                <Logomark className="w-[16px]" />
                            </span>
                        )}
                    </div>
                    <strong>{profile.data.attributes.firstName || 'Anonymous'}</strong>
                    {pronouns && <span className="text-xs opacity-70 ml-1">({pronouns})</span>}
                </Link>
                {badgeText && (
                    <span className="border border-gray-accent-light dark:border-gray-accent-dark text-xs py-0.5 px-1 rounded-sm">
                        {badgeText}
                    </span>
                )}
                <Days created={createdAt} />
                {resolved && resolvedBy?.data?.id === id && (
                    <>
                        <span className="border rounded-sm text-[#008200cc] text-xs font-semibold py-0.5 px-1 uppercase">
                            Solution
                        </span>
                        {(isAuthor || isModerator) && (
                            <button
                                onClick={() => handleResolve(false, null)}
                                className="text-sm font-semibold text-red dark:text-yellow"
                            >
                                Undo
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className="border-l-0 ml-[33px] pl-0 pb-1">
                {profile.data.id === Number(process.env.GATSBY_AI_PROFILE_ID) && helpful === null && (
                    <AIDisclaimer replyID={id} refresh={mutate} />
                )}
                <div className={reply?.attributes?.helpful === false ? 'opacity-60' : ''}>
                    <Markdown>{body}</Markdown>
                </div>
                {profile.data.id === Number(process.env.GATSBY_AI_PROFILE_ID) && helpful && (
                    <div className="bg-accent dark:bg-accent-dark p-2 rounded-md border border-border dark:border-dark mb-4">
                        <p className="m-0 text-sm">
                            AI response generate by{' '}
                            <Link to="https://inkeep.com" externalNoIcon>
                                Inkeep
                            </Link>
                            .
                        </p>
                    </div>
                )}

                <div className="flex space-x-2 mb-4 relative -top-2 empty:hidden">
                    {resolvable && (
                        <button
                            onClick={() => handleResolve(true, id)}
                            className="text-red dark:text-yellow font-semibold text-sm"
                        >
                            Mark as solution
                        </button>
                    )}
                    {isModerator && (
                        <button
                            onClick={() => handlePublishReply(!!publishedAt, id)}
                            className="text-red dark:text-yellow font-semibold text-sm"
                        >
                            {publishedAt ? 'Unpublish' : 'Publish'}
                        </button>
                    )}
                    {isModerator && (
                        <button onClick={handleDelete} className="text-[red] font-semibold text-sm">
                            {confirmDelete ? 'Click again to confirm' : 'Delete'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    ) : null
}
